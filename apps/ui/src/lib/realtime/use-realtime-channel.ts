'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/browser';

// Subscribe to a single broadcast event on a Supabase Realtime channel.
// Re-subscribes when channelName or eventName change; the callback identity
// is captured in a ref so it can update freely without re-subscribing.
//
//   useRealtimeBroadcast<UserCreatedEvent>(
//     process.env.NEXT_PUBLIC_DOMAIN_EVENTS_CHANNEL!,
//     'UserCreated',
//     (event) => setUsers((u) => [...u, event.payload]),
//   );
export function useRealtimeBroadcast<TPayload = unknown>(
  channelName: string,
  eventName: string,
  onMessage: (payload: TPayload) => void,
) {
  const callbackRef = useRef(onMessage);
  callbackRef.current = onMessage;

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(channelName);
    // supabase-js types `msg.payload` as `any` (broadcast frames have arbitrary
    // shapes). Cast at the consumer boundary so handlers get TPayload.
    channel.on('broadcast', { event: eventName }, (msg) => {
      callbackRef.current(msg['payload'] as TPayload);
    });
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelName, eventName]);
}
