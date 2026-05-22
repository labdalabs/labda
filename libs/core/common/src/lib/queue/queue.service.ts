import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from '../db/tokens';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(@Inject(DB_CONNECTION) private readonly db: NodePgDatabase) {}

  // Enqueue a single message. Returns the pgmq msg_id.
  async send<T>(queueName: string, payload: T, delaySec = 0): Promise<bigint> {
    const result = await this.db.execute<{ send: bigint; [key: string]: unknown }>(
      sql`select pgmq.send(${queueName}::text, ${JSON.stringify(payload)}::jsonb, ${delaySec}::int) as send`,
    );
    const msgId = result.rows[0]?.send;
    if (msgId == null) {
      throw new Error(`pgmq.send returned no msg_id for queue ${queueName}`);
    }
    this.logger.debug(`Enqueued msg ${msgId} to ${queueName}`);
    return msgId;
  }

  // Enqueue many messages in a single call. Returns the msg_ids in order.
  async sendBatch<T>(queueName: string, payloads: T[]): Promise<bigint[]> {
    if (payloads.length === 0) return [];
    const json = JSON.stringify(payloads);
    const result = await this.db.execute<{ send_batch: bigint; [key: string]: unknown }>(
      sql`select pgmq.send_batch(${queueName}::text, array(select jsonb_array_elements(${json}::jsonb))) as send_batch`,
    );
    return result.rows.map((r) => r.send_batch);
  }
}
