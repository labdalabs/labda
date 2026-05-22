import { SetMetadata } from '@nestjs/common';

export const ON_DOMAIN_EVENT_METADATA = 'common:on-domain-event';

// Mark a method as a domain-event handler. Wire-up scans all providers for
// methods carrying this metadata on Nest bootstrap and binds them to the
// Supabase Realtime channel.
//
// Use the event type's string literal so a typo fails at construction time.
//
//   @OnDomainEvent('UserCreated')
//   handleUserCreated(event: UserCreatedEvent) { ... }
export const OnDomainEvent = (eventType: string) =>
  SetMetadata(ON_DOMAIN_EVENT_METADATA, eventType);
