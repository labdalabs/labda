# ADR-0021: Realtime via Supabase Broadcast

## TL;DR

Use Supabase Realtime Broadcast channels for **live-to-browser fan-out** (presence, collaborative editing, live UI updates, agent-active indicators). Channels are named `<resource-type>:<resource-id>`; the backend publishes via the service-role client; browsers subscribe via the anon client subject to RLS on the realtime tables. Broadcast is **not** the backend event bus — domain events (ADR-0008) continue to flow over RabbitMQ / SNS+SQS / pgmq for backend-to-backend async. The two transports serve two different purposes.

**Status:** Accepted
**Date:** 2026-05-11
**Applies to:** projects on the Supabase variant (ADR-0019) that need live UI updates.

## Context

Some features need updates pushed to the browser as they happen:

- A second user joins a document and the first user's UI should show their presence.
- A collaborative editor needs to fan out CRDT updates to all connected clients.
- A long-running AI tool call should surface progress in the chat UI.
- A dashboard widget should reflect a value as it changes.

In the standard stack we'd reach for GraphQL Subscriptions over `graphql-ws` backed by `graphql-redis-subscriptions`. That works but it routes every update through our Nest process and ties subscription auth to our session middleware.

Supabase Realtime Broadcast is a managed pub/sub that browsers can connect to directly. Channels are ephemeral, messages are not persisted, and access is controlled by RLS on the `realtime.messages` (Broadcast) and `realtime.subscription` tables.

**Critical distinction:** Broadcast is for browser fan-out. It is **not** a replacement for the domain event bus (ADR-0008 / ADR-0009). Domain events are typed, validated, durable, and routed between backend bounded contexts. Broadcast messages are ephemeral payloads aimed at the UI. Mixing the two creates a fragile architecture where backend logic depends on a tool optimized for client fan-out.

## Decision

### Channel naming

`<resource-type>:<resource-id>` — e.g., `workspace:abc-123`, `document:def-456`, `thread:ghi-789`. One channel per addressable resource.

For per-user notifications, use `user:<user-id>` (subject to RLS — only the user themselves can subscribe).

### Publishing (backend)

Wrap the Supabase service-role client in a `RealtimeBroadcastService` that lives in `libs/core/common` (or in the bounded context that owns the channel — depends on whether multiple contexts publish to the same channel; default to common for the shared infrastructure):

```ts
@Injectable()
export class RealtimeBroadcastService implements OnModuleDestroy {
  private readonly logger = new Logger(RealtimeBroadcastService.name);
  private readonly supabase: SupabaseClient;
  private readonly channels = new Map<string, RealtimeChannel>();

  constructor(configService: ConfigService) {
    this.supabase = createClient(
      configService.getOrThrow<string>('supabase.url'),
      configService.getOrThrow<string>('supabase.serviceRoleKey'),
      { auth: { persistSession: false } },
    );
  }

  async broadcast(channelName: string, event: string, payload: unknown): Promise<void> {
    const channel = await this.getOrCreateChannel(channelName);
    await channel.send({ type: 'broadcast', event, payload });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.channels.values()].map((c) => c.unsubscribe()));
    await this.supabase.removeAllChannels();
  }

  private async getOrCreateChannel(name: string): Promise<RealtimeChannel> {
    const existing = this.channels.get(name);
    if (existing) return existing;
    const channel = this.supabase.channel(name);
    await new Promise<void>((resolve, reject) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve();
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(new Error(`Realtime channel ${name} failed: ${status}`));
        }
      });
    });
    this.channels.set(name, channel);
    return channel;
  }
}
```

### Subscribing (frontend)

Use the browser Supabase client (anon key):

```tsx
'use client';
import { useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export function useWorkspaceUpdates(workspaceId: string, onUpdate: (msg: unknown) => void) {
  useEffect(() => {
    const supabase = createBrowserClient(/* url, anon key */);
    const channel = supabase.channel(`workspace:${workspaceId}`);
    channel.on('broadcast', { event: 'updated' }, ({ payload }) => onUpdate(payload));
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [workspaceId, onUpdate]);
}
```

### Authorization

- **Backend publishing** uses the service-role key — bypasses RLS. Trust the backend to publish only what's appropriate.
- **Browser subscribing** uses the anon key. **RLS on the `realtime.messages` table** (and the underlying `realtime.subscription` table) controls who can subscribe to which channel. Write RLS policies that match channel name to user access:

```sql
-- Allow a user to subscribe to a workspace channel only if they're a member.
create policy "users subscribe to their workspaces"
on realtime.messages
for select using (
  realtime.topic() like 'workspace:%'
  and exists (
    select 1 from workspace_member m
    where m.workspace_id = split_part(realtime.topic(), ':', 2)::uuid
      and m.user_id = auth.uid()
  )
);
```

### When to publish a Broadcast message

The common pattern: a backend service finishes a write, publishes a `DomainEvent<T>` (ADR-0008), and ALSO publishes a Broadcast message for the browsers that care:

```ts
await this.db.transaction(async (tx) => {
  // ...writes
  await this.eventBusService.publish(new DocumentUpdatedEvent(payload, userId));
});

// After the transaction commits, fan out to clients
await this.realtimeBroadcastService.broadcast(
  `document:${documentId}`,
  'updated',
  { documentId, version: nextVersion },
);
```

Reasons to keep these separate:

- **Domain events** are durable, validated, routed between contexts, used for side effects (analytics, notifications, projections). They survive a deploy.
- **Broadcast messages** are ephemeral. A browser that misses one gets the latest state on its next query. They're a UX optimization, not a system of record.

A consumer queue handler can also trigger Broadcasts when it produces user-visible state — that's normal.

### Presence

Supabase Realtime also offers a presence API (`channel.track({ user_id })`) to know who's currently subscribed. Use it for "who's viewing this document" — same channel as Broadcast.

## Consequences

**Accept:**

- Browsers connect direct to Supabase Realtime — no proxy through Nest, no `graphql-ws` to maintain.
- Channels are addressable by name; no centralized subscription registry.
- Presence is built in.
- Local dev: `supabase start` ships Realtime; no extra moving parts.

**Live with:**

- **Two transports.** The backend event bus (Rabbit/SNS+SQS/pgmq) handles backend async; Broadcast handles client fan-out. Reviewers must keep them in their lanes. Backend logic depending on Broadcast delivery is a smell.
- **No delivery guarantees on Broadcast.** Messages are ephemeral and lossy. The browser's UI must be able to reconcile from a fresh query when needed. Don't encode authoritative state changes in Broadcast payloads.
- **RLS on `realtime.messages` is critical.** A missing policy means open subscription to any channel name a user can guess. Default-deny and explicit allow.
- **Channel limits.** Each Supabase plan has a max concurrent channels / connections / messages-per-second. Architect for that — one channel per resource scales linearly with active resources, which is the right curve.
- **Cleanup on the backend.** The `RealtimeBroadcastService` accumulates channels in a Map. Channels stay open across publishes (correct — that's how Realtime works). Drop them on shutdown via `onModuleDestroy`.

## References

- ADR-0008: Domain events as first-class artifacts (the backend event bus that Broadcast does NOT replace)
- ADR-0009: Event transport variants (Rabbit / SNS+SQS / pgmq — all alternatives to Broadcast)
- ADR-0019: Supabase as managed infrastructure backbone
- `add-domain-event` skill in `.claude/skills/` (for the backend half of the pattern)
