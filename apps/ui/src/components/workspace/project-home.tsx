'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@labda/ui/components/ui/button';
import { useWorkspace } from '@/lib/workspace/store';
import {
  createAgentSession,
  deleteAgentSession,
  listSessions,
  type AgentSession,
} from '@/lib/session/queries';

// The project's main "Work" view: start focused agent sessions. Each session is
// a persisted EVE thread scoped to a goal — it survives reloads and reopens as a
// tab with its full conversation intact.
const SUGGESTIONS = [
  'Design an experiment to test my leading hypothesis',
  'Find supporting and contradicting literature',
  'Draft a protocol from my latest idea',
  'Summarize what the knowledge graph knows so far',
];

export function ProjectHome({ projectId }: { projectId: string }) {
  const openTab = useWorkspace((s) => s.openTab);
  const closeTab = useWorkspace((s) => s.closeTab);
  const [goal, setGoal] = useState('');
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setSessions(await listSessions(projectId));
    } catch {
      /* no sessions / no access */
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function open(s: AgentSession) {
    openTab({
      key: `session:${s.id}`,
      kind: 'session',
      title: s.goal.length > 22 ? `${s.goal.slice(0, 22)}…` : s.goal,
      goal: s.goal,
      sessionId: s.id,
      closeable: true,
    });
  }

  async function start(text: string) {
    const g = text.trim();
    if (!g || busy) return;
    setBusy(true);
    try {
      const s = await createAgentSession({ projectId, goal: g });
      setGoal('');
      await refresh();
      open(s);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: AgentSession) {
    try {
      await deleteAgentSession(s.id);
      closeTab(`session:${s.id}`);
      await refresh();
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-8 p-8" data-testid="project-home">
      <header>
        <h1 className="font-heading text-2xl font-semibold">Work</h1>
        <p className="text-sm text-muted-foreground">
          Start a focused agent session — each is its own thread with a goal, and
          reopens as a tab with its conversation intact.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void start(goal);
        }}
        className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm"
      >
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="What should the agent work on?"
          aria-label="Session goal"
          className="min-h-24 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <Button
          type="submit"
          disabled={!goal.trim() || busy}
          className="bg-brand-sky text-white shadow-sm transition-colors hover:bg-brand-sky/90"
          data-testid="start-session"
        >
          {busy ? 'Starting…' : 'Start session'}
        </Button>
      </form>

      <div className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Or start from
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void start(s)}
              className="rounded-lg border bg-card px-3 py-2.5 text-left text-sm text-foreground/80 transition-colors hover:border-brand-sky/50 hover:bg-brand-sky/5"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {sessions.length > 0 && (
        <div className="space-y-2" data-testid="session-list">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Sessions
          </h2>
          <ul className="space-y-1">
            {sessions.map((s) => (
              <li key={s.id} className="group flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => open(s)}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md border bg-card px-3 py-2 text-left text-sm hover:bg-muted/60"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  <span className="truncate">{s.goal}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void remove(s)}
                  aria-label="Delete session"
                  className="rounded-md p-1.5 text-muted-foreground/50 opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
