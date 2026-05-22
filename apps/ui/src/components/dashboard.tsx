'use client';

import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Button } from '@labda/ui/components/ui/button';
import { apiFetch, ApiError } from '@/lib/api/client';
import { useRealtimeBroadcast } from '@/lib/realtime/use-realtime-channel';

interface MeResponse {
  id: string;
  email?: string;
  role: string;
}

// Demo dashboard shown to authenticated users. Three things wired:
//   1. Calls GET /me through the typed API client (Bearer token attached
//      from the Supabase session by `apiFetch`).
//   2. Subscribes to a specific broadcast event on the domain-events channel.
//   3. Renders a sign-out form pointed at /auth/sign-out.
//
// Swap 'ExampleEvent' below for an event name your backend publishes via
// `eventBusService.publish(new YourEvent(...))`.
export function Dashboard({ user }: { user: User }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [events, setEvents] = useState<unknown[]>([]);

  const channelName = process.env.NEXT_PUBLIC_DOMAIN_EVENTS_CHANNEL ?? '';

  useRealtimeBroadcast(channelName, 'ExampleEvent', (payload) => {
    setEvents((prev) => [payload, ...prev].slice(0, 20));
  });

  async function callMe() {
    setMeError(null);
    try {
      setMe(await apiFetch<MeResponse>('/me'));
    } catch (err) {
      setMeError(err instanceof ApiError ? `${err.status} ${err.message}` : String(err));
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-8 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Signed in</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <form method="POST" action="/auth/sign-out">
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </header>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">API: GET /me</h2>
          <Button onClick={callMe} size="sm">
            Call API
          </Button>
        </div>
        {meError && <p className="text-sm text-destructive">{meError}</p>}
        {me && (
          <pre className="overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
            {JSON.stringify(me, null, 2)}
          </pre>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">
          Realtime: {channelName || '(channel unset)'} / ExampleEvent
        </h2>
        <p className="text-xs text-muted-foreground">
          Publish from the API via{' '}
          <code className="rounded bg-muted px-1">eventBusService.publish(...)</code>;
          matching events stream in below.
        </p>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events received yet.</p>
        ) : (
          <ul className="space-y-1">
            {events.map((event, i) => (
              <li key={i} className="rounded-md border bg-muted/40 p-2 text-xs">
                <pre>{JSON.stringify(event, null, 2)}</pre>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
