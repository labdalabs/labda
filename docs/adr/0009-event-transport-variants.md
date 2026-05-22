# ADR-0009: Event transport variants (RabbitMQ ↔ SNS/SQS)

## TL;DR

The `DomainEvent` model from ADR-0008 is transport-agnostic. Use **RabbitMQ** topic exchange for self-hosted or local-first deployments; use **AWS SNS + SQS FIFO** with DLQs in managed cloud deploys. Same publish API, same event classes, same validation — only the consumer decorator (`@RabbitSubscribe` vs `@SqsMessageHandler`) and the infra wiring change.

**Status:** Accepted
**Date:** 2026-05-11

## Context

ADR-0008 commits to typed, validated `DomainEvent<T>` objects flowing through a topic-routed bus. The transport that carries them is an operational decision, not an architectural one:

- **Self-hosted / local dev / single-host deployments:** RabbitMQ is sufficient, runs in Docker Compose, and adds no cloud lock-in.
- **AWS production:** SNS (for fan-out) + SQS FIFO (for per-context queues with DLQs) gives managed delivery, retries, and zero ops overhead.

We want the same event model and the same publishing/consuming code in both cases — the transport difference is confined to wiring.

## Decision

The event model (ADR-0008) is invariant. The transport is chosen per project.

### RabbitMQ (self-hosted / local)

- **Library:** `@golevelup/nestjs-rabbitmq` + `amqp-connection-manager` + `amqplib`.
- **Topology:** a single topic exchange `EVENT_BUS_EXCHANGE` (declared `durable: true`) per app.
- **Wiring:** `libs/core/common/src/lib/eventbus/eventbus.module.ts` configures `RabbitMQModule.forRootAsync` with the URI from `eventBus.rabbitMqUrl` config.
- **Publishing:** `EventBusService.publish` calls `clientRMQ.publish(EVENT_BUS_EXCHANGE, routingKey, message, { persistent: true })`. Routing key: `events.<origin>.<version>.<eventType>.<userId|system>`.
- **Consuming:** each bounded context has `@RabbitSubscribe({ exchange, routingKey: 'events.#', queue: '<DOMAIN>-domain-queue', errorBehavior: MessageHandlerErrorBehavior.REQUEUE })` on its handler. The wildcard `events.#` routing key means every queue sees every event; the handler's `switch` filters.
- **Error behavior:** `REQUEUE` for retries on transient failure. Persistent failures need manual triage; an outbox + dedup table will be added when needed.
- **Local infra:** `docker-compose.yml` runs Postgres, Redis, and RabbitMQ.

### SNS + SQS FIFO (AWS)

- **Library:** AWS SDK + Nest microservice transport.
- **Topology:** a single SNS topic `coreEventsTopic` per app. Per-context SQS FIFO queues (`CoreOrderQueue`, `CoreCatalogQueue`, `CoreCheckoutJobQueue`, `CoreSubscriptionQueue`, `CoreNotificationQueue`, etc.), each with a Dead Letter Queue (DLQ).
- **Wiring:** `libs/infra/src/lib/infra.sst.ts` defines the SST resources (topic, queues, subscriptions, DLQs, redrive policy). The Nest app receives the queue URLs via env.
- **Publishing:** `EventBusService.publish` publishes the same `DomainEvent` object as JSON to the SNS topic with the same `events.<origin>.<version>.<eventType>.<userId|system>` routing key encoded as the SNS message attributes used for SQS subscription filters.
- **Consuming:** each context's `<context>.queue.ts` declares an `@SqsMessageHandler(QUEUE_<DOMAIN>, true)` method. The handler receives raw SQS message bodies; each is `JSON.parse`'d to extract the inner SNS `Message`, then deserialized via `eventBusService.validateMessageString(body.Message)`, then dispatched by `switch (eventType)`.
- **Error behavior:** SQS retries up to `maxReceiveCount`, then the DLQ holds the message for offline inspection.
- **Local infra:** SST dev (live Lambda) or LocalStack; Docker Compose still runs Postgres and Redis for the Nest process.

### Common to both

- A given project uses ONE transport for all events.
- The same `DomainEvent<T>` payload shape is preserved across transports.
- The same `EventBusService` API is used by services (`publish(event)`). Only the internal implementation and the consumer decorator differ.
- Future outbox + idempotent consumer keys (dedup) carry over between transports.

## Consequences

**Accept:**

- Local dev needs only Docker Compose; no AWS dependency for self-hosted setups.
- Production AWS gets managed delivery, automatic scaling, DLQs, and FIFO ordering guarantees for free.
- Switching transports is an infra and adapter change, not a model change. The Facade and event consumers do not move.
- The same `class-validator` validation runs at both ends regardless of transport.

**Live with:**

- A project-template generator must choose the transport at scaffold time. Mixing both in one project is out of scope and adds no value.
- Inter-project event federation (one project publishing events that another project consumes) is NOT supported by this model. Cross-project integration goes through HTTP/webhook contracts at the bounded-context surface.
- DLQ handling is project-specific: SQS has structural DLQs; the Rabbit path requires manual handling or a future dedicated DLQ exchange.
- FIFO ordering exists on SQS; topic exchanges in Rabbit do not provide ordering across keys. Consumers must be idempotent for both transports.
