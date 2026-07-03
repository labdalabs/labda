'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { UseEveAgentRuntimeOptions } from '@assistant-ui/eve';
import { EveChat } from '@/components/eve/eve-chat';
import { listSessions, saveAgentSession } from '@/lib/session/queries';

type Events = NonNullable<UseEveAgentRuntimeOptions['initialEvents']>;
type Session = UseEveAgentRuntimeOptions['initialSession'];

function safeParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// A persisted EVE session: seed the runtime with the stored transcript so the
// conversation resumes on reload, and stream new events back to the backend so
// it stays saved. Saves are THROTTLED (checkpoint at most every ~1.2s even
// during a long stream) and FLUSHED on tab-hide / unmount / unload, so the tail
// of a turn is never lost.
export function SessionChat({
  projectId,
  sessionId,
  goal,
}: {
  projectId: string;
  sessionId: string;
  goal?: string;
}) {
  const [seed, setSeed] = useState<{ events: Events; session: Session } | null>(
    null,
  );
  const eventsRef = useRef<Events>([] as unknown as Events);
  const sessionRef = useRef<Session>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!dirty.current) return;
    dirty.current = false;
    void saveAgentSession({
      id: sessionId,
      transcript: JSON.stringify(eventsRef.current),
      sessionState: sessionRef.current
        ? JSON.stringify(sessionRef.current)
        : undefined,
    }).catch(() => undefined);
  }, [sessionId]);

  // Throttle: mark dirty and ensure a save fires within ~1.2s. Unlike a debounce
  // this does NOT reset on each event, so a continuous stream still checkpoints.
  const schedule = useCallback(() => {
    dirty.current = true;
    if (timer.current) return;
    timer.current = setTimeout(flush, 1200);
  }, [flush]);

  useEffect(() => {
    let live = true;
    listSessions(projectId)
      .then((sessions) => {
        if (!live) return;
        const s = sessions.find((x) => x.id === sessionId);
        const events = safeParse<Events>(
          s?.transcript,
          [] as unknown as Events,
        );
        const session = safeParse<Session>(s?.sessionState ?? null, undefined);
        eventsRef.current = events;
        sessionRef.current = session;
        setSeed({ events, session });
      })
      .catch(() =>
        setSeed({ events: [] as unknown as Events, session: undefined }),
      );
    return () => {
      live = false;
    };
  }, [projectId, sessionId]);

  // Flush pending saves when the tab is hidden, the page unloads, or this
  // component unmounts (tab closed / switched away).
  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener('beforeunload', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('beforeunload', onHide);
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, [flush]);

  if (!seed) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Loading session…</div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <EveChat
        projectId={projectId}
        goal={goal}
        initialEvents={seed.events}
        initialSession={seed.session}
        onEvent={(e) => {
          eventsRef.current = [...eventsRef.current, e] as Events;
          schedule();
        }}
        onSessionChange={(s) => {
          sessionRef.current = s;
          schedule();
        }}
        className="flex h-[calc(100vh-9rem)] flex-col overflow-hidden rounded-lg border"
      />
    </div>
  );
}
