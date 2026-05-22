import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from '../db/tokens';
import {
  QUEUE_HANDLER_METADATA,
  QueueHandlerMetadata,
} from './queue-handler.decorator';

type PgmqMessage = {
  msg_id: string;
  read_ct: number;
  enqueued_at: string;
  vt: string;
  message: unknown;
  [key: string]: unknown;
};

interface RunningLoop {
  meta: QueueHandlerMetadata;
  invoke: (message: unknown) => Promise<unknown>;
  timer?: NodeJS.Timeout;
}

@Injectable()
export class QueueWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueWorker.name);
  private readonly loops: RunningLoop[] = [];
  private shuttingDown = false;

  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit(): void {
    this.collectHandlers();
    for (const loop of this.loops) {
      this.scheduleNext(loop, 0);
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;
    for (const loop of this.loops) {
      if (loop.timer) clearTimeout(loop.timer);
    }
  }

  private collectHandlers(): void {
    const providers = this.discoveryService.getProviders();
    for (const wrapper of providers) {
      const { instance } = wrapper;
      if (!instance || typeof instance !== 'object') continue;
      const prototype = Object.getPrototypeOf(instance);
      if (!prototype) continue;
      this.metadataScanner.getAllMethodNames(prototype).forEach((methodName) => {
        const method = prototype[methodName];
        const meta = this.reflector.get<QueueHandlerMetadata>(
          QUEUE_HANDLER_METADATA,
          method,
        );
        if (!meta) return;
        this.loops.push({
          meta: {
            pollIntervalMs: 1000,
            visibilityTimeoutSec: 30,
            maxAttempts: 5,
            ...meta,
          },
          invoke: (msg) => method.call(instance, msg),
        });
        this.logger.log(
          `Registered handler ${wrapper.name}.${methodName} for queue ${meta.queueName}`,
        );
      });
    }
  }

  private scheduleNext(loop: RunningLoop, delayMs: number): void {
    if (this.shuttingDown) return;
    loop.timer = setTimeout(() => {
      this.tick(loop).catch((err) => {
        this.logger.error(`Worker tick for ${loop.meta.queueName} failed: ${err}`);
      });
    }, delayMs);
  }

  private async tick(loop: RunningLoop): Promise<void> {
    const result = await this.db.execute<PgmqMessage>(
      sql`select msg_id, read_ct, enqueued_at, vt, message
            from pgmq.read(${loop.meta.queueName}::text, ${loop.meta.visibilityTimeoutSec!}::int, 1)`,
    );
    const message = result.rows[0];
    if (!message) {
      this.scheduleNext(loop, loop.meta.pollIntervalMs!);
      return;
    }
    try {
      if (message.read_ct > loop.meta.maxAttempts!) {
        this.logger.warn(
          `Archiving msg ${message.msg_id} from ${loop.meta.queueName} after ${message.read_ct} attempts`,
        );
        await this.db.execute(
          sql`select pgmq.archive(${loop.meta.queueName}::text, ${message.msg_id}::bigint)`,
        );
      } else {
        await loop.invoke(message.message);
        await this.db.execute(
          sql`select pgmq.delete(${loop.meta.queueName}::text, ${message.msg_id}::bigint)`,
        );
      }
    } catch (err) {
      // Leave the message — visibility timeout expires and it gets re-read.
      this.logger.error(
        `Handler for ${loop.meta.queueName} threw on msg ${message.msg_id}: ${err}`,
      );
    } finally {
      this.scheduleNext(loop, 0);
    }
  }
}
