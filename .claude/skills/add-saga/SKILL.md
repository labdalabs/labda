---
name: add-saga
description: Use when the user asks to "add a saga", "wire a multi-step workflow", "orchestrate X then Y then Z across contexts", "model a checkout flow", "payment + fulfillment + notify", or any process that spans several events with compensation on failure. Defines a state-machine-driven saga that subscribes to events, persists state, and publishes follow-up events.
---

# add-saga

A saga is a long-running workflow that orchestrates a sequence of steps across bounded contexts via domain events. Each step subscribes to one event, does work, optionally publishes the next event, and persists state so failures can be retried or compensated.

This is the right pattern when:

- A process spans **multiple bounded contexts** that should not be synchronously coupled.
- Steps can **fail independently** and need **compensation** (refund a charge, cancel a shipment, undo a reservation).
- The process is **long-running** (minutes to days) and survives process restarts.

If the workflow is purely intra-context and short-lived, a service method with a transaction is enough — don't reach for a saga.

## When to use

- Checkout: reserve inventory → charge card → confirm order → ship → notify. Each step is a separate context.
- Onboarding: account created → workspace created → seed data loaded → welcome email queued.
- Integration sync: webhook received → fetch detail → normalize → upsert → propagate.
- Anything with the shape "event A triggers work that emits event B which triggers work that emits event C".

## Inputs to confirm

1. **Saga name** (e.g., `CheckoutSaga`, `OnboardingSaga`).
2. **Owning bounded context** — typically the context that "starts" the saga. For cross-context flows, put it in a context that has a natural lifecycle stake (e.g., `order` for checkout).
3. **Trigger event** — what kicks off the saga.
4. **Step graph** — each step's input event, the work it does, and the event it publishes on success / failure.
5. **Compensation steps** — for each step that's irreversible (charge, send), what's the undo event?
6. **Timeouts** — how long can a step pause before we consider it stuck?

## Architecture

Two patterns:

### Pattern A: Orchestrator saga (centralized)

One service owns the workflow definition. It subscribes to every step's outcome event, decides the next step, and publishes the trigger event for that step. State lives in a single saga-instance table.

```
[OrderCreated] → CheckoutSaga.handleOrderCreated
                  → publishes ReserveInventoryRequested

[InventoryReserved] → CheckoutSaga.handleInventoryReserved
                       → publishes ChargeRequested
                       (or, on failure, publishes OrderCancelled)

[ChargeCompleted] → CheckoutSaga.handleChargeCompleted
                     → publishes ShipmentRequested
                     (or, on failure, publishes InventoryReleaseRequested + OrderCancelled)
```

Pros: workflow definition in one place; easy to reason about.
Cons: the orchestrator service touches every context's events.

### Pattern B: Choreographed saga (decentralized)

No central orchestrator. Each context handles its own piece and publishes its own outcome. The "saga" is the emergent dance.

Pros: no central coupling.
Cons: workflow is invisible; debugging requires reading every queue.

**Default to Pattern A** for new sagas unless the workflow has only 2-3 steps and changes rarely.

## Steps (Pattern A — Orchestrator)

1. **Create the saga state table** in `libs/core/common/src/lib/db/schema.ts`:

   ```ts
   export const checkoutSaga = pgTable('checkout_saga', {
     id: uuid('id').primaryKey(),                 // saga instance ID
     orderId: uuid('order_id').notNull(),
     state: text('state').notNull(),              // current step name
     payload: jsonb('payload').notNull(),         // accumulated context
     startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
     updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
     completedAt: timestamp('completed_at', { withTimezone: true }),
     failedAt: timestamp('failed_at', { withTimezone: true }),
     lastError: text('last_error'),
   });
   ```

   Generate and apply the migration (see `add-drizzle-table`).

2. **Create `<saga-name>.service.ts`** in the owning context. The service:

   - Owns the saga state.
   - Has one method per inbound event (the "handlers").
   - Persists state transitions before publishing the next event.

   ```ts
   import { Inject, Injectable, Logger } from '@nestjs/common';
   import { NodePgDatabase } from 'drizzle-orm/node-postgres';
   import { eq } from 'drizzle-orm';
   import {
     DB_CONNECTION,
     EventBusService,
     checkoutSaga,
     // event classes:
     OrderCreatedEvent,
     InventoryReservedEvent,
     InventoryReservationFailedEvent,
     ChargeRequestedEvent,
     ChargeCompletedEvent,
     ChargeFailedEvent,
     ShipmentRequestedEvent,
     InventoryReleaseRequestedEvent,
     OrderCancelledEvent,
   } from '@<project>/core-common';

   const State = {
     STARTED: 'STARTED',
     INVENTORY_RESERVED: 'INVENTORY_RESERVED',
     CHARGED: 'CHARGED',
     COMPLETED: 'COMPLETED',
     FAILED: 'FAILED',
   } as const;

   @Injectable()
   export class CheckoutSagaService {
     private readonly logger = new Logger(CheckoutSagaService.name);

     constructor(
       @Inject(DB_CONNECTION) private readonly db: NodePgDatabase,
       private readonly eventBusService: EventBusService,
     ) {}

     async onOrderCreated(event: OrderCreatedEvent) {
       const sagaId = randomUUID();
       const now = new Date();

       await this.db.transaction(async (tx) => {
         await tx.insert(checkoutSaga).values({
           id: sagaId,
           orderId: event.payload.orderId,
           state: State.STARTED,
           payload: { orderId: event.payload.orderId, workspaceId: event.payload.workspaceId },
           startedAt: now,
           updatedAt: now,
         });

         await this.eventBusService.publish(new ReserveInventoryRequestedEvent({
           orderId: event.payload.orderId,
           sagaId,
           emittedAt: now.toISOString(),
         }));
       });
     }

     async onInventoryReserved(event: InventoryReservedEvent) {
       await this.db.transaction(async (tx) => {
         const [saga] = await tx.select().from(checkoutSaga)
           .where(eq(checkoutSaga.id, event.payload.sagaId)).for('update');

         if (!saga || saga.state !== State.STARTED) return;

         await tx.update(checkoutSaga).set({
           state: State.INVENTORY_RESERVED,
           updatedAt: new Date(),
         }).where(eq(checkoutSaga.id, saga.id));

         await this.eventBusService.publish(new ChargeRequestedEvent({
           orderId: saga.orderId,
           sagaId: saga.id,
           emittedAt: new Date().toISOString(),
         }));
       });
     }

     async onInventoryReservationFailed(event: InventoryReservationFailedEvent) {
       await this.failSaga(event.payload.sagaId, event.payload.reason);
     }

     async onChargeCompleted(event: ChargeCompletedEvent) { /* ...similar */ }

     async onChargeFailed(event: ChargeFailedEvent) {
       // Compensation: release the inventory we reserved.
       await this.db.transaction(async (tx) => {
         const [saga] = await tx.select().from(checkoutSaga)
           .where(eq(checkoutSaga.id, event.payload.sagaId)).for('update');
         if (!saga) return;

         await tx.update(checkoutSaga).set({
           state: State.FAILED,
           lastError: event.payload.reason,
           failedAt: new Date(),
           updatedAt: new Date(),
         }).where(eq(checkoutSaga.id, saga.id));

         await this.eventBusService.publish(new InventoryReleaseRequestedEvent({
           orderId: saga.orderId,
           sagaId: saga.id,
           emittedAt: new Date().toISOString(),
         }));
         await this.eventBusService.publish(new OrderCancelledEvent({
           orderId: saga.orderId,
           reason: event.payload.reason,
           emittedAt: new Date().toISOString(),
         }));
       });
     }

     private async failSaga(sagaId: string, reason: string) {
       const now = new Date();
       await this.db.update(checkoutSaga).set({
         state: State.FAILED,
         lastError: reason,
         failedAt: now,
         updatedAt: now,
       }).where(eq(checkoutSaga.id, sagaId));
     }
   }
   ```

3. **Wire the queue handlers** in `<context>.queue.ts` — add `case`s for every event the saga subscribes to:

   ```ts
   case EventType.ORDER_CREATED:
     return this.checkoutSagaService.onOrderCreated(event as OrderCreatedEvent);
   case EventType.INVENTORY_RESERVED:
     return this.checkoutSagaService.onInventoryReserved(event as InventoryReservedEvent);
   case EventType.INVENTORY_RESERVATION_FAILED:
     return this.checkoutSagaService.onInventoryReservationFailed(event as InventoryReservationFailedEvent);
   case EventType.CHARGE_COMPLETED:
     return this.checkoutSagaService.onChargeCompleted(event as ChargeCompletedEvent);
   case EventType.CHARGE_FAILED:
     return this.checkoutSagaService.onChargeFailed(event as ChargeFailedEvent);
   ```

4. **Carry the `sagaId` on every step's events.** When step N publishes the request for step N+1, the request payload includes `sagaId`. When the step completes, it echoes `sagaId` in its outcome. This is how the orchestrator correlates outcomes back to the saga instance.

5. **Define a stuck-saga sweeper.** A scheduled job (`@nestjs/schedule`) queries sagas whose `updatedAt < now() - timeout` and either retries the current step or fails the saga. Compensation runs on failure.

6. **Add specs.** Unit-test each handler:
   - Happy path advances state.
   - Failure transitions to compensation.
   - Idempotency: re-handling the same event in the same state is a no-op (`if (saga.state !== EXPECTED_STATE) return`).

## Idempotency

Events may be redelivered. Every handler MUST:

- Look up the saga by ID.
- Check the current state is one this handler can act on.
- Use `.for('update')` to prevent concurrent processing.
- Be a no-op if the state has already advanced past this step.

## Timeouts and compensation

For each step that does external work (charge card, ship package, send email):

- Define a timeout (e.g., 5 minutes for a card charge).
- Have the scheduled sweeper detect stalled sagas and publish a `<Step>TimedOutEvent`.
- The saga's `onXTimedOut` handler runs compensation and fails the saga.

## Rules

- **DO** persist saga state before publishing the next event (same transaction).
- **DO** carry the `sagaId` through every event in the chain.
- **DO** make every handler idempotent (check state before acting).
- **DO** use `.for('update')` when loading the saga row.
- **DO** define compensation for every irreversible step.
- **DO** add a stuck-saga sweeper from day 1.
- **DON'T** reach across contexts synchronously inside a saga — that's the whole point of decoupling via events.
- **DON'T** rely on event ordering. Out-of-order delivery is possible; the state check protects you.
- **DON'T** start with a choreographed saga unless the workflow is tiny and stable.

## References

- ADR-0008: Domain events as first-class artifacts (saga steps are events)
- ADR-0009: Event transport variants
- ADR-0006: Drizzle transactions + `.for('update')` row locking
- `add-drizzle-table` skill (for the saga state table)
- `add-domain-event` skill (for the per-step events)
- `add-queue-consumer` skill (for routing step events into the saga handlers)
