'use client';

import { useState } from 'react';
import { Button } from '@labda/ui/components/ui/button';
import { useWorkspace } from '@/lib/workspace/store';

// The project's main "Work" view: start focused agent sessions. Each session is
// its own EVE thread scoped to a goal, opened as a tab you can return to.
const SUGGESTIONS = [
  'Design an experiment to test my leading hypothesis',
  'Find supporting and contradicting literature',
  'Draft a protocol from my latest idea',
  'Summarize what the knowledge graph knows so far',
];

export function ProjectHome({ projectId: _projectId }: { projectId: string }) {
  const tabs = useWorkspace((s) => s.tabs);
  const openTab = useWorkspace((s) => s.openTab);
  const setActive = useWorkspace((s) => s.setActive);
  const [goal, setGoal] = useState('');
  const sessions = tabs.filter((t) => t.kind === 'session');

  function start(text: string) {
    const g = text.trim();
    if (!g) return;
    openTab({
      key: `session:${Date.now()}`,
      kind: 'session',
      title: g.length > 22 ? `${g.slice(0, 22)}…` : g,
      goal: g,
      closeable: true,
    });
    setGoal('');
  }

  return (
    <section className="mx-auto max-w-2xl space-y-8 p-8" data-testid="project-home">
      <header>
        <h1 className="font-heading text-2xl font-semibold">Work</h1>
        <p className="text-sm text-muted-foreground">
          Start a focused agent session — each is its own thread with a goal, and
          opens as a tab you can return to.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(goal);
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
          disabled={!goal.trim()}
          className="bg-brand-sky text-white shadow-sm transition-colors hover:bg-brand-sky/90"
          data-testid="start-session"
        >
          Start session
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
              onClick={() => start(s)}
              className="rounded-lg border bg-card px-3 py-2.5 text-left text-sm text-foreground/80 transition-colors hover:border-brand-sky/50 hover:bg-brand-sky/5"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {sessions.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Sessions
          </h2>
          <ul className="space-y-1">
            {sessions.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => setActive(s.key)}
                  className="flex w-full items-center gap-2 rounded-md border bg-card px-3 py-2 text-left text-sm hover:bg-muted/60"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span className="truncate">{s.goal}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
