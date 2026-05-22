---
name: add-domain-event
description: Use when the user asks to "add a domain event", "publish an event when X happens", "wire async between contexts", "add a new DomainEvent", or "emit a [Subject][Verb]Event". Implements the 4-step recipe for adding a typed, validated event to the bus.
---

# add-domain-event

Add a new `DomainEvent<TPayload>` to the system. Events are typed end-to-end, validated at every boundary, and routed via a topic key derived from `<origin>.<version>.<eventType>.<userId|system>`.

## When to use

- The user wants context A to notify context B of something asynchronously.
- A side effect (email, search index update, analytics rollup, integration sync) needs to happen after a write.
- The user mentions an event name in past tense: `<Subject><Verb>Event` (e.g., `OrderShippedEvent`, `InvoicePaidEvent`, `MemberJoinedEvent`).

## Inputs to confirm

1. **Event name** in PascalCase, past tense, ending in `Event`.
2. **`EventType` enum value** in UPPER_SNAKE_CASE (e.g., `ORDER_SHIPPED`).
3. **Origin `Domain`** — the publishing context.
4. **Payload fields** with types (UUIDs, dates, enums, strings).
5. **Consumers** — which context(s) will subscribe.

## Steps

1. **Add the event type to the central catalog** in `libs/core/common/src/lib/models/domain.model.ts`:

   ```ts
   export enum EventType {
     // ...existing entries
     ORDER_SHIPPED = 'ORDER_SHIPPED',
   }
   ```

2. **Define the payload class** with `class-validator` decorators on every field:

   ```ts
   export class OrderShippedEventPayload {
     @IsUUID() orderId!: string;
     @IsUUID() workspaceId!: string;
     @IsDateString() shippedAt!: string;
     @IsDateString() emittedAt!: string;
   }
   ```

3. **Define the event class** extending `DomainEvent<TPayload>`. The constructor hard-codes `version`, `eventType`, `origin`:

   ```ts
   export class OrderShippedEvent extends DomainEvent<OrderShippedEventPayload> {
     @Type(() => OrderShippedEventPayload)
     payload!: OrderShippedEventPayload;

     constructor(
       payload: Pick<OrderShippedEventPayload, keyof OrderShippedEventPayload>,
       userId?: string,
     ) {
       super(randomUUID(), EventVersion.V1, EventType.ORDER_SHIPPED, Domain.ORDER, userId);
       this.payload = plainToInstance(OrderShippedEventPayload, payload);
     }
   }
   ```

4. **Register in the lookup map** so consumers can deserialize:

   ```ts
   export const EventTypeToDomainEventMap = {
     // ...existing
     [EventType.ORDER_SHIPPED]: OrderShippedEvent,
   };
   ```

5. **Add to the `DomainEventType` union:**

   ```ts
   export type DomainEventType =
     | /* ...existing events */
     | OrderShippedEvent;
   ```

6. **Publish from the originating service** — inside the transaction that committed the change:

   ```ts
   await this.db.transaction(async (tx) => {
     // ...writes
     await this.eventBusService.publish(
       new OrderShippedEvent(
         { orderId, workspaceId, shippedAt: now.toISOString(), emittedAt: now.toISOString() },
         actingUserId,
       ),
     );
   });
   ```

7. **Consume in the receiving context's `<context>.queue.ts`** — add a `case`:

   ```ts
   switch (domainEvent.eventType) {
     // ...existing cases
     case EventType.ORDER_SHIPPED: {
       const { payload } = domainEvent as OrderShippedEvent;
       await this.notificationService.sendShipmentEmail(payload.orderId);
       break;
     }
   }
   ```

## Rules

- **DO** name events in past tense (`OrderShipped`, never `ShipOrder`).
- **DO** include `emittedAt` (ISO string) on every payload.
- **DO** validate every field with `class-validator` decorators.
- **DO** publish from inside the originating transaction.
- **DO** mark queue handlers `@Public()` (they don't have a user context).
- **DON'T** publish raw objects (`{ type, data }`). Always construct the typed event class.
- **DON'T** mutate a V1 payload. If breaking, add `V2` and run both consumers in parallel.
- **DON'T** make events into commands. Events are facts; commands go through Facades.

## Anti-patterns

- Publishing AFTER the transaction commits — loses atomicity. Publish inside; the transaction rolls back if the publisher throws.
- Multi-purpose events ("UserUpdatedEvent" with a `changedFields` blob). Split into specific past-tense facts.
- Skipping the `EventTypeToDomainEventMap` entry — consumers can't deserialize the inbound JSON.

## References

- ADR-0008: Domain events as first-class artifacts
- ADR-0009: Event transport variants (RabbitMQ ↔ SNS/SQS)
