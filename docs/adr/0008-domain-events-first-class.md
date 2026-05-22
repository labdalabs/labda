# ADR-0008: Domain events as first-class artifacts

## TL;DR

A domain event is a class extending `DomainEvent<TPayload>` with `class-validator`-decorated payload. Adding one is a 4-step recipe (enum entry, payload class, event class, map entry). Events publish from inside the originating transaction; consumers in `<context>.queue.ts` switch on `eventType`. Single-context apps with no async cross-module work may skip the event bus entirely.

**Status:** Accepted
**Date:** 2026-05-11

## Context

Cross-context coordination via synchronous Facade calls handles only the cases where the caller can wait for the callee. Anything fan-out, anything that touches a slow external system, anything that decouples lifecycle (e.g., auth notified that a member joined a workspace; downstream contexts notified that an integration connected) wants to be asynchronous.

Naïve pub/sub of untyped payloads makes runtime validation impossible and turns the event bus into a stringly-typed nightmare. We want:

- Every event is a typed object end to end.
- Payloads are validated at the boundary (publish AND consume).
- The catalog of known events is discoverable in one place.
- Adding a new event is a recipe, not an architecture meeting.
- The shape is invariant across transports (Rabbit, SNS/SQS — see ADR-0009).

## Decision

A domain event is a class. It extends a generic base `DomainEvent<TPayload extends EventPayload>` in `libs/core/common/src/lib/models/domain.model.ts`:

```ts
abstract class DomainEvent<T extends EventPayload> {
  @IsUUID()  id!: string;
  @IsEnum(EventVersion)  version!: EventVersion;
  @IsEnum(EventType)  eventType!: EventType;
  @IsEnum(Domain)  origin!: Domain;
  @ValidateNested()  abstract payload: T;
  @IsOptional() @IsUUID()  userId?: string;
}
```

**Per-event recipe:**

1. Add the event type to the central `EventType` enum.
2. Define the payload class with `class-validator` decorators (`@IsUUID`, `@IsEmail`, `@IsDateString`, `@IsString`, `@IsEnum`, `@IsOptional`).
3. Define the event class extending `DomainEvent<YourPayload>` with `@Type(() => YourPayload)` on `payload`; the constructor hard-codes `version`, `eventType`, `origin`, and calls `super(randomUUID(), ...)`; the payload is built via `plainToInstance(YourPayload, payload)`.
4. Add the class to the `EventTypeToDomainEventMap` lookup so consumers can deserialize inbound JSON.

**Publishing:**

```ts
await this.eventBusService.publish(
  new WorkspaceMemberJoinedEvent(
    { workspaceId, userId, role, email, joinedAt, emittedAt },
    actingUserId,
  ),
);
```

`EventBusService.publish` (in `libs/core/common/src/lib/eventbus/eventbus.service.ts`):

- Runs `class-validator` `validate(message)`; rejects with `BadRequestException` on failure.
- Publishes to the transport with a routing key derived from `getTopicFromMessage`: `events.<origin>.<version>.<eventType>.<userId|system>`.

**Consuming:**

- Each bounded context has a `<context>.queue.ts` with `@Public()` (skip auth) and the transport-appropriate decorator (`@RabbitSubscribe` for Rabbit, `@SqsMessageHandler` for SQS — ADR-0009).
- The handler receives a `DomainEventType` union; a `switch (domainEvent.eventType)` discriminates and dispatches to a service method.
- Inbound JSON (SQS body, untyped Rabbit payload) is deserialized via `eventBusService.validateMessageString(messageString)` which:
  - Parses JSON.
  - Looks up the class via `EventTypeToDomainEventMap[eventType]`.
  - Constructs via `plainToInstance`.
  - Validates via `class-validator`.
  - Returns `null` on any failure (logged at debug level).

**Conventions:**

- Events are named past-tense (`WorkspaceCreatedEvent`, `WorkspaceMemberJoinedEvent`, `IntegrationConnectedEvent`).
- Every event carries `emittedAt` (ISO string).
- Events represent facts that have happened, never commands. Commands are Facade calls (ADR-0005).
- Events are typically published from inside the originating transaction (ADR-0006). Outbox-based delivery is planned (placeholder enum entries `TICKET_STATUS_CHANGED`, `COMMENT_ADDED`, `CODE_PUSHED` reserve the slot).

## Consequences

**Accept:**

- Every event is typed end-to-end and validated at every boundary. A malformed payload cannot enter the system.
- Adding a new event is a 4-step recipe; the change is mechanical and reviewable.
- Replay is structurally possible: events are self-describing JSON with versions.
- Cross-context coupling becomes a list of subscriptions, not a hidden web of method calls. The architecture diagram is the queue files.

**Live with:**

- The central catalog (`EventType` enum + `EventTypeToDomainEventMap`) is a point of contention for parallel work. Mild merge cost; manageable.
- Pure point-to-point RPC-shaped messages do not fit the model and should not be forced into it. Use a Facade.
- Event-after-commit delivery is not yet truly transactional. The current pattern (publish inside the transaction) is best-effort: if Rabbit/SNS is unreachable at commit time, the event is lost. Outbox pattern is the next step; do not write code that DEPENDS on at-least-once delivery until it lands.
- Event versioning: `EventVersion` is `V1` today. When a payload's shape needs to evolve incompatibly, add `V2` and run both consumers in parallel; do not mutate the V1 payload.
