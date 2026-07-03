'use client';

import { useEffect, useRef, useState } from 'react';
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
// conversation resumes on reload, and stream new events back to the backend
// (debounced) so it stays saved.
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
      if (timer.current) clearTimeout(timer.current);
    };
  }, [projectId, sessionId]);

  function save() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void saveAgentSession({
        id: sessionId,
        transcript: JSON.stringify(eventsRef.current),
        sessionState: sessionRef.current
          ? JSON.stringify(sessionRef.current)
          : undefined,
      }).catch(() => undefined);
    }, 1200);
  }

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
          save();
        }}
        onSessionChange={(s) => {
          sessionRef.current = s;
          save();
        }}
        className="flex h-[calc(100vh-9rem)] flex-col overflow-hidden rounded-lg border"
      />
    </div>
  );
}
