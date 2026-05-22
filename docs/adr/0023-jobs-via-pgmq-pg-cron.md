# ADR-0023: Jobs queue via pgmq + pg_cron

## TL;DR

Use **pgmq** (Postgres-native message queue extension) for jobs and as a third transport option for `DomainEvent<T>` (alongside RabbitMQ and SNS+SQS — see ADR-0009). Use **pg_cron** for scheduled jobs (alongside or instead of `@nestjs/schedule`). Workers are Nest services that poll `pgmq.read()`, validate the payload via `EventBusService.validateMessageString`, dispatch via `switch (eventType)`, and `pgmq.delete()` (or `pgmq.archive()` for retention) on success. Trade-off: simpler ops (everything in Postgres, no Redis or Rabbit) versus lower throughput than dedicated brokers.

**Status:** Accepted
**Date:** 2026-05-11
**Applies to:** projects on the Supabase variant (ADR-0019) that want a Postgres-native queue. Compatible with the GraphQL or REST/MCP API flavors.

## Context

The standard stack uses BullMQ + Redis for jobs and RabbitMQ (or SNS+SQS) for domain-event routing. That's two pieces of infrastructure on top of Postgres. The Supabase variant aims for fewer moving parts: if Postgres can carry the queue load, we keep it in Postgres.

**pgmq** is a Postgres extension that exposes queue primitives as SQL functions: `pgmq.create`, `pgmq.send`, `pgmq.read`, `pgmq.delete`, `pgmq.archive`. Each queue is a Postgres table; visibility timeouts give at-most-once-during-processing semantics; archives provide a poor man's DLQ.

**pg_cron** is a Postgres extension that schedules SQL execution. It runs `cron.schedule('<name>', '<cron-expr>', $$ <sql> $$)` in the DB and replaces `@nestjs/schedule` for periodic work that can be expressed as SQL (cleanup, archive sweeps, periodic enqueues).

Both extensions are first-class in Supabase Postgres. Enable them once per project.

This ADR specifies how we use them.

## Decision

### Queue declaration

Queues are declared in a migration so they're versioned:

```sql
-- Enable extensions (idempotent)
create extension if not exists pgmq;
create extension if not exists pg_cron;

-- Create queues
select pgmq.create('domain_events');
select pgmq.create('emails');
select pgmq.create('integration_sync');
```

One queue for domain events (`domain_events`) and one per coarse job type (`emails`, `integration_sync`, ...). Don't fan out to a queue per event type — the worker switch handles that.

### Publishing

Adapt `EventBusService.publish` (ADR-0008) to write via `pgmq.send`. The `DomainEvent<T>` payload is unchanged.

```ts
@Injectable()
export class EventBusService {
  private logger = new Logger(EventBusService.name);

  constructor(@Inject(DB_CONNECTION) private readonly db: NodePgDatabase) {}

  async publish(message: DomainEventType): Promise<void> {
    const errors = await validate(message);
    if (errors.length > 0) {
      throw new BadRequestException('Invalid message format');
    }
    await this.db.execute(sql`select pgmq.send('domain_events', ${JSON.stringify(message)}::jsonb)`);
  }
}
```

Send inside the originating transaction (same rule as ADR-0006 / ADR-0008). Failure rolls back the writes.

### Consuming

A Nest service per bounded context that needs to react polls the queue:

```ts
@Injectable()
export class <Context>QueueWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(<Context>QueueWorker.name);
  private readonly visibilityTimeoutSeconds = 30;
  private readonly batchSize = 10;
  private readonly pollIntervalMs = 1000;
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase,
    private readonly eventBusService: EventBusService,
    private readonly <context>Service: <Context>Service,
  ) {}

  onModuleInit() { this.timer = setInterval(() => this.tick(), this.pollIntervalMs); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  private async tick() {
    try {
      const messages = await this.db.execute(sql`
        select * from pgmq.read('domain_events', ${this.visibilityTimeoutSeconds}, ${this.batchSize})
      `);
      for (const msg of messages.rows as Array<{ msg_id: bigint; message: unknown }>) {
        const event = await this.eventBusService.validateMessageString(JSON.stringify(msg.message));
        if (!event) {
          await this.db.execute(sql`select pgmq.archive('domain_events', ${msg.msg_id})`);
          continue;
        }
        try {
          await this.handle(event);
          await this.db.execute(sql`select pgmq.delete('domain_events', ${msg.msg_id})`);
        } catch (err) {
          this.logger.error({ err, msgId: msg.msg_id }, 'Handler failed; will retry');
          // Don't delete; visibility timeout expires and the message comes back.
          // Add a max-receive-count check via msg.read_ct if available, then archive.
        }
      }
    } catch (err) {
      this.logger.error({ err }, 'Queue tick failed');
    }
  }

  private async handle(event: DomainEventType) {
    switch (event.eventType) {
      case EventType.<EVENT_TYPE>: {
        await this.<context>Service.onX((event as <Event>).payload);
        break;
      }
    }
  }
}
```

Notes:

- **Visibility timeout** (30s default) — long enough for the handler to complete in typical conditions. Tune per workload.
- **Batch size** (10 default) — read up to N messages per tick. Process serially or in parallel depending on the handler.
- **At-least-once delivery.** Handlers MUST be idempotent.
- **DLQ pattern.** Track `read_ct` (read count) on the message; archive after `read_ct > MAX_RETRIES`. `pgmq.archive` moves the message to a sibling archive table for offline inspection.
- **No long-running handlers.** If a handler takes longer than the visibility timeout, the message is redelivered. Either shorten the work, extend the timeout, or `pgmq.set_vt` to extend per-message.

### Scheduled jobs via pg_cron

For periodic work that can be expressed as SQL — clean-up sweeps, archive purging, periodic enqueue of follow-up work — use pg_cron:

```sql
-- Every minute, archive messages stuck for too long
select cron.schedule(
  'archive_stuck_jobs',
  '* * * * *',
  $$
    insert into pgmq.a_domain_events
    select * from pgmq.q_domain_events
    where read_ct > 5
    returning pgmq.delete('domain_events', msg_id);
  $$
);

-- Every night, run nightly aggregations
select cron.schedule(
  'nightly_aggregations',
  '0 2 * * *',
  $$ select run_nightly_aggregations(); $$
);
```

For periodic work that needs application code, keep `@nestjs/schedule` — `pg_cron` only does SQL. The split:

- **`pg_cron`** for SQL-only periodic work AND for periodically enqueuing jobs that the worker will pick up.
- **`@nestjs/schedule`** for in-process tasks that need TypeScript/Nest DI access.

### Replacing BullMQ

`@nestjs/bullmq` and Redis-backed queues are no longer required in the Supabase variant — pgmq covers the same surface (jobs queue with retries and DLQ-like semantics) with one less moving part. If you have an existing BullMQ-shaped flow you want to keep (e.g., for high-throughput batched jobs that pgmq can't comfortably carry), keep BullMQ alongside pgmq — they don't conflict. Document the choice per-queue.

## Consequences

**Accept:**

- No Redis or RabbitMQ to operate. Postgres is the single backing store for data, queues, and scheduled jobs.
- Queue messages are inspectable via SQL. `select * from pgmq.q_domain_events` answers "what's pending?".
- Transactional publishing — `pgmq.send` runs in the same transaction as your writes, so events follow the same atomicity guarantees as the data they describe.
- `pg_cron` schedules live with the schema in migrations; one less surface to forget about.

**Live with:**

- **Throughput ceiling.** pgmq is fast for normal product loads (hundreds to low thousands of messages per second) but it's bounded by Postgres write throughput. For very high-volume queues (hot integration ingest, massive fan-out), use SNS+SQS or RabbitMQ.
- **Polling latency.** A 1-second poll interval introduces up to 1 second of delivery latency. Most product flows tolerate this. Lower the interval at the cost of more DB queries.
- **DLQ is convention, not built-in.** Track `read_ct` and archive yourself (or use the pg_cron sweeper above).
- **Workers stay alive on app startup.** A Nest deployment without the worker module running is a stuck queue. Ensure the worker module is imported in the right env(s).
- **Visibility timeout edge cases.** A handler that takes longer than the timeout will see the same message redelivered. Idempotency is non-negotiable.

## References

- ADR-0008: Domain events as first-class artifacts (the model carried over pgmq unchanged)
- ADR-0009: Event transport variants (pgmq is the third option; RabbitMQ and SNS+SQS remain valid)
- ADR-0019: Supabase as managed infrastructure backbone
- `use-supabase-queues` skill in `.claude/skills/`
