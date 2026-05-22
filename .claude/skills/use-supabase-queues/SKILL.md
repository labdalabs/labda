---
name: use-supabase-queues
description: Use when the user asks to "use pgmq", "add a Postgres queue", "switch jobs to pgmq", "wire pg_cron", "Supabase queues", "Postgres-native jobs". Sets up a pgmq queue, a polling worker, and (optionally) a pg_cron-scheduled enqueuer.
---

# use-supabase-queues

Add a Postgres-native queue using **pgmq** (Postgres message queue extension) and/or scheduled work via **pg_cron**. Workers are Nest services that poll `pgmq.read()`, dispatch, and `pgmq.delete()`. This replaces BullMQ for jobs and provides a third transport for `DomainEvent<T>` (alongside RabbitMQ and SNS+SQS).

## When to use

- A new job queue is needed and the project is on the Supabase variant.
- Existing BullMQ-backed jobs are being migrated to Postgres-native.
- A scheduled task can be expressed as SQL and you want it in pg_cron rather than `@nestjs/schedule`.

## Inputs to confirm

1. **Queue name** (snake_case, descriptive — `domain_events`, `emails`, `integration_sync`).
2. **Visibility timeout** (seconds the message is hidden after a worker reads it; default 30).
3. **Batch size** (how many messages per poll; default 10).
4. **Poll interval** (default 1000ms).
5. **Max retries before archive** (default 5).
6. **Worker's owning context** (which bounded context's `<context>.module.ts` registers the worker).

## Steps

### 1. Enable extensions and create the queue (one-time per queue)

`supabase/migrations/<timestamp>_create_queue_<name>.sql`:

```sql
create extension if not exists pgmq;
create extension if not exists pg_cron;

select pgmq.create('domain_events');
```

Apply with `pnpm supabase db push` (dev) or `supabase migration up` (CI/prod).

### 2. Publish from a service

If migrating the `EventBusService`, swap the publish implementation to use `pgmq.send`:

```ts
@Injectable()
export class EventBusService {
  private logger = new Logger(EventBusService.name);

  constructor(@Inject(DB_CONNECTION) private readonly db: NodePgDatabase) {}

  async publish(message: DomainEventType): Promise<void> {
    const errors = await validate(message);
    if (errors.length > 0) {
      this.logger.error(`Invalid message: ${JSON.stringify(errors)}`);
      throw new BadRequestException('Invalid message format');
    }
    await this.db.execute(
      sql`select pgmq.send('domain_events', ${JSON.stringify(message)}::jsonb)`,
    );
  }
}
```

Calling code is unchanged from ADR-0008:

```ts
await this.eventBusService.publish(new OrderShippedEvent(payload, userId));
```

For ad-hoc jobs that aren't domain events (e.g., "send this email"), publish directly to the relevant queue with a shape your worker recognizes — or model them as `DomainEvent<T>` for consistency.

### 3. Create the worker

`libs/core/<context>/src/lib/<context>.queue-worker.ts`:

```ts
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import {
  DB_CONNECTION,
  DomainEventType,
  EventBusService,
  EventType,
  OrderShippedEvent,
} from '@<project>/core-common';
import { <Context>Service } from './<context>.service';

const VISIBILITY_TIMEOUT_SEC = 30;
const BATCH_SIZE = 10;
const POLL_INTERVAL_MS = 1000;
const MAX_RETRIES = 5;

interface PgmqMessage {
  msg_id: bigint;
  read_ct: number;
  enqueued_at: Date;
  vt: Date;
  message: unknown;
}

@Injectable()
export class <Context>QueueWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(<Context>QueueWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase,
    private readonly eventBusService: EventBusService,
    private readonly <context>Service: <Context>Service,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => this.tick(), POLL_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return; // skip if previous tick still running
    this.running = true;
    try {
      const result = await this.db.execute(sql`
        select * from pgmq.read('domain_events', ${VISIBILITY_TIMEOUT_SEC}, ${BATCH_SIZE})
      `);
      for (const row of result.rows as PgmqMessage[]) {
        await this.processOne(row);
      }
    } catch (err) {
      this.logger.error({ err }, 'Queue tick failed');
    } finally {
      this.running = false;
    }
  }

  private async processOne(msg: PgmqMessage): Promise<void> {
    const event = await this.eventBusService.validateMessageString(
      typeof msg.message === 'string' ? msg.message : JSON.stringify(msg.message),
    );
    if (!event) {
      this.logger.warn({ msgId: msg.msg_id }, 'Unparseable message; archiving');
      await this.archive(msg.msg_id);
      return;
    }
    try {
      await this.dispatch(event);
      await this.delete(msg.msg_id);
    } catch (err) {
      this.logger.error(
        { err, msgId: msg.msg_id, readCt: msg.read_ct, eventType: event.eventType },
        'Handler failed',
      );
      if (msg.read_ct >= MAX_RETRIES) {
        this.logger.warn({ msgId: msg.msg_id }, 'Max retries exceeded; archiving');
        await this.archive(msg.msg_id);
      }
      // Otherwise: visibility timeout expires, message comes back.
    }
  }

  private async dispatch(event: DomainEventType) {
    switch (event.eventType) {
      case EventType.ORDER_SHIPPED: {
        const { payload } = event as OrderShippedEvent;
        await this.<context>Service.onOrderShipped(payload);
        break;
      }
      // ...other cases
    }
  }

  private delete(msgId: bigint) {
    return this.db.execute(sql`select pgmq.delete('domain_events', ${msgId})`);
  }

  private archive(msgId: bigint) {
    return this.db.execute(sql`select pgmq.archive('domain_events', ${msgId})`);
  }
}
```

### 4. Register the worker

In `libs/core/<context>/src/lib/<context>.module.ts`:

```ts
providers: [<Context>Service, <Context>Facade, <Context>QueueWorker, /* ... */],
```

The worker module must be imported by `apps/<api>/src/app/app.module.ts` (typically already is via the context module). Don't register workers in modules that only run in some envs without thinking — if the worker module isn't loaded, the queue silently fills up.

### 5. Optional: pg_cron sweeper for stuck messages

If you want a backup safety net that archives messages with too-high `read_ct` independent of any worker noticing:

```sql
select cron.schedule(
  'archive_stuck_domain_events',
  '* * * * *',
  $$
    do $body$
    declare m record;
    begin
      for m in
        select msg_id from pgmq.q_domain_events where read_ct >= 5
      loop
        perform pgmq.archive('domain_events', m.msg_id);
      end loop;
    end
    $body$;
  $$
);
```

### 6. Optional: pg_cron scheduled jobs

For SQL-only periodic work:

```sql
select cron.schedule(
  'nightly_aggregations',
  '0 2 * * *',
  $$ select run_nightly_aggregations(); $$
);

select cron.schedule(
  'hourly_enqueue_pending_emails',
  '0 * * * *',
  $$
    insert into pgmq.q_emails (message)
    select jsonb_build_object('to', email, 'template', 'reminder')
    from user_reminder where due_at < now() and sent_at is null;
  $$
);
```

For periodic work that needs Nest DI / TypeScript code, keep `@nestjs/schedule`.

### 7. Inspect a queue

```sql
-- pending messages
select msg_id, read_ct, enqueued_at, message
from pgmq.q_domain_events
order by msg_id desc limit 20;

-- archived (DLQ)
select msg_id, archived_at, message
from pgmq.a_domain_events
order by archived_at desc limit 20;

-- queue metrics
select * from pgmq.metrics('domain_events');
```

Use Supabase Studio's SQL editor for ops.

## Rules

- **DO** make handlers idempotent. pgmq is at-least-once.
- **DO** track `read_ct` and archive after `MAX_RETRIES` — there is no built-in DLQ.
- **DO** publish inside the originating transaction (same rule as ADR-0006 / ADR-0008).
- **DO** keep the visibility timeout > handler runtime, or extend with `pgmq.set_vt` for long-running work.
- **DO** ensure the worker module is loaded in every env that consumes the queue. A worker-less app is a stuck queue.
- **DON'T** skip the `read_ct` check and let messages retry forever.
- **DON'T** put SQL-only periodic work in `@nestjs/schedule` if it can live in pg_cron — pg_cron keeps schedules with the schema and survives app restarts.
- **DON'T** use pgmq for very high throughput (low thousands+ msgs/sec). Use SNS+SQS or RabbitMQ for that.

## Migrating from BullMQ

For each BullMQ queue:

1. Create a corresponding pgmq queue.
2. Replace `Queue.add(name, data)` with `pgmq.send(queue, jsonb)`.
3. Replace `Processor` with a `<Context>QueueWorker` polling the pgmq queue.
4. Remove the BullMQ + Redis dependency once all queues are migrated.

## References

- ADR-0023: Jobs queue via pgmq + pg_cron
- ADR-0008: Domain events as first-class artifacts (the payload model)
- ADR-0009: Event transport variants (RabbitMQ / SNS+SQS / pgmq)
- ADR-0019: Supabase as managed infrastructure backbone
