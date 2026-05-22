---
name: add-queue-consumer
description: Use when the user asks to "add a queue consumer", "subscribe to a domain event", "wire @RabbitSubscribe", "@SqsMessageHandler", or "make context X react to event Y". Adds or extends a <context>.queue.ts handler.
---

# add-queue-consumer

Each bounded context that needs to react to domain events owns one `<context>.queue.ts` file. It's an `@Injectable()` with one handler method decorated for the chosen transport (RabbitMQ or SQS) and a `switch (eventType)` that dispatches to service methods.

## When to use

- A new bounded context needs to consume any domain events.
- An existing context needs to handle a new event type (add a `case`).
- The user describes a reaction: "when X happens, do Y" where X is a domain event.

## Inputs to confirm

1. **Bounded context** — which context will handle the event.
2. **Transport** — RabbitMQ (self-hosted) or SQS (AWS). The project chose one at scaffold time; check `app.module.ts`.
3. **Event types to handle** — which `EventType` enum values.
4. **Handler logic** — the service method(s) to call when each event fires.

## Steps

### RabbitMQ version

1. **Create `libs/core/<context>/src/lib/<context>.queue.ts`**:

   ```ts
   import { Injectable, Logger } from '@nestjs/common';
   import { RabbitSubscribe, MessageHandlerErrorBehavior } from '@golevelup/nestjs-rabbitmq';
   import {
     Domain,
     DomainEventType,
     EVENT_BUS_EXCHANGE,
     EventType,
     Public,
     // event classes you'll handle:
     OrderShippedEvent,
   } from '@<project>/core-common';
   import { <Context>Service } from './<context>.service';

   @Injectable()
   export class <Context>Queue {
     private readonly logger = new Logger(<Context>Queue.name);

     constructor(private readonly <context>Service: <Context>Service) {}

     @Public()
     @RabbitSubscribe({
       exchange: EVENT_BUS_EXCHANGE,
       routingKey: 'events.#',
       queue: `${Domain.<CONTEXT>}-domain-queue`,
       errorBehavior: MessageHandlerErrorBehavior.REQUEUE,
     })
     async handleMessage(domainEvent: DomainEventType) {
       this.logger.debug({ domainEvent }, 'Received domain event');

       switch (domainEvent.eventType) {
         case EventType.ORDER_SHIPPED: {
           const { payload } = domainEvent as OrderShippedEvent;
           await this.<context>Service.onOrderShipped(payload);
           break;
         }
         // ...more cases
       }
     }
   }
   ```

2. **Register in `<context>.module.ts`** as a provider:

   ```ts
   providers: [<Context>Service, <Context>Facade, <Context>Queue, /* ... */],
   ```

### SQS version

Same shape, different decorator:

```ts
@SqsMessageHandler(QUEUE_<CONTEXT>, true)
async handleMessage(messages: Message[]) {
  for (const message of messages) {
    const body = JSON.parse(message.Body!);
    const event = await this.eventBusService.validateMessageString(body.Message);
    if (!event) continue;

    switch (event.eventType) {
      case EventType.ORDER_SHIPPED: {
        const { payload } = event as OrderShippedEvent;
        await this.<context>Service.onOrderShipped(payload);
        break;
      }
    }
  }
}
```

For SQS the message body wraps the SNS envelope (`body.Message` is the actual event JSON), so deserialize via `eventBusService.validateMessageString`. Failures naturally fall through to the DLQ via SQS's `maxReceiveCount`.

## Adding a new case to an existing queue

1. Import the event class.
2. Add a `case EventType.<EVENT_TYPE>:` to the switch.
3. Cast the event (`as <Event>`) and call the service.

## Rules

- **DO** mark the handler `@Public()` — queue consumers don't have a user context.
- **DO** make handlers idempotent. Events may be redelivered.
- **DO** dispatch to a service method, not implement logic inline.
- **DO** wildcard subscribe (`routingKey: 'events.#'`) and filter in the switch — keeps the routing topology simple.
- **DO** log the event at debug on entry; log errors with the event ID in context.
- **DON'T** publish a new event in response without thinking about loops. Use a different event type that can't trigger this handler.
- **DON'T** mutate the inbound event. Treat it as immutable.

## References

- ADR-0008: Domain events as first-class artifacts
- ADR-0009: Event transport variants (RabbitMQ ↔ SNS/SQS)
