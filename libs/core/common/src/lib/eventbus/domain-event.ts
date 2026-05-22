// Base shape for every domain event published on the bus.
//
// Subclasses add typed `payload` and a static `eventType` literal so a publisher
// is forced to name the event consistently and a consumer can pattern-match by
// the string. Validation happens via class-validator on `payload`.

export abstract class DomainEvent<TPayload = unknown> {
  abstract readonly eventType: string;
  readonly emittedAt: string = new Date().toISOString();
  abstract readonly payload: TPayload;
}
