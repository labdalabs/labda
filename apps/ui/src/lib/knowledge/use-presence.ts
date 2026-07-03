'use client';

import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/browser';

export interface PresenceUser {
  userId: string;
  name: string;
  nodeId: string | null;
}

// Per-project Supabase Realtime presence: everyone viewing a project's graph
// joins one channel and continuously publishes which node they're focused on.
// Returns the OTHER participants (not you), so the canvas can show who is
// reading/focusing which node in real time. Agents that crawl can join the same
// channel with a node id to surface where the agent is looking.
export function usePresence(
  projectId: string,
  focusedNodeId: string | null,
  // When false (e.g. the board is an inactive workspace tab), leave the channel
  // so you don't appear present/focused to collaborators while working
  // elsewhere.
  active = true,
): PresenceUser[] {
  const [others, setOthers] = useState<PresenceUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const meRef = useRef<{ id: string; name: string } | null>(null);
  // Always-current focus, so the (async) SUBSCRIBED handler tracks the node the
  // user is on *now*, not the one captured when the effect first ran.
  const focusRef = useRef(focusedNodeId);
  focusRef.current = focusedNodeId;

  useEffect(() => {
    if (!projectId || !active) {
      setOthers([]);
      return;
    }
    let live = true;
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !live) return;
      const name = (user.email ?? 'someone').split('@')[0];
      meRef.current = { id: user.id, name };

      channel = supabase.channel(`presence:project:${projectId}`, {
        config: { presence: { key: user.id } },
      });
      channelRef.current = channel;

      const recompute = () => {
        const state = channel?.presenceState() ?? {};
        const list: PresenceUser[] = [];
        for (const [key, metas] of Object.entries(state)) {
          if (key === user.id) continue;
          // Latest meta wins (a re-track updates the trailing entry).
          const arr = metas as Array<Record<string, unknown>>;
          const meta = arr[arr.length - 1] ?? {};
          list.push({
            userId: key,
            name: (meta['name'] as string) ?? 'someone',
            nodeId: (meta['nodeId'] as string) ?? null,
          });
        }
        setOthers(list);
      };
      // Recompute on every presence change — sync doesn't always re-fire when a
      // key merely updates its own meta (a focus change), so watch join/leave too.
      channel
        .on('presence', { event: 'sync' }, recompute)
        .on('presence', { event: 'join' }, recompute)
        .on('presence', { event: 'leave' }, recompute)
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            void channel?.track({ name, nodeId: focusRef.current });
          }
        });
    })();

    return () => {
      live = false;
      if (channel) void supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // Re-join when the project changes or the board becomes (in)active; focus
    // updates re-track below via a separate effect (focusedNodeId intentionally
    // not a dep here).
  }, [projectId, active]);

  // Publish focus changes without rejoining the channel.
  useEffect(() => {
    const channel = channelRef.current;
    const me = meRef.current;
    if (channel && me) {
      void channel.track({ name: me.name, nodeId: focusedNodeId });
    }
  }, [focusedNodeId]);

  return others;
}
