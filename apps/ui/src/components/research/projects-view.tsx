'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@labda/ui/components/ui/button';
import { Input } from '@labda/ui/components/ui/input';
import { ApiError } from '@/lib/api/client';
import { createProject, listProjects } from '@/lib/research/queries';
import type { Project } from '@/lib/research/types';

export function ProjectsView({
  authenticated = true,
  email,
}: {
  authenticated?: boolean;
  email: string;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(authenticated);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setProjects(await listProjects());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Zero-friction: only fetch (which requires auth) when signed in. Browsing
    // the shell needs no signup.
    if (authenticated) void refresh();
  }, [authenticated, refresh]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError('');
    try {
      await createProject({
        title: title.trim(),
        description: description.trim() || undefined,
      });
      setTitle('');
      setDescription('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-8 p-8">
      <header>
        <h1 className="font-heading text-2xl font-semibold">Projects</h1>
        <p className="text-sm text-muted-foreground">
          {authenticated ? email : 'Browsing Labda'}
        </p>
      </header>

      {!authenticated && (
        <div
          className="rounded-xl border bg-muted/30 p-4 text-sm"
          data-testid="signin-banner"
        >
          You&rsquo;re browsing Labda. {' '}
          <Link href="/auth/sign-in" className="underline">
            Sign in
          </Link>{' '}
          to create Projects and use the copilot.
        </div>
      )}

      {authenticated && (
      <form
        onSubmit={handleCreate}
        className="overflow-hidden rounded-2xl border bg-card shadow-sm"
        data-testid="create-project-form"
      >
        <div className="flex items-center gap-3 border-b bg-gradient-to-r from-brand-sky/10 via-brand-sky/[0.04] to-transparent px-6 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-sky/15 text-brand-sky">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <path d="M12 11v5M9.5 13.5h5" />
            </svg>
          </span>
          <div>
            <h2 className="font-heading text-base font-semibold leading-tight">
              New project
            </h2>
            <p className="text-xs text-muted-foreground">
              A workspace for a line of inquiry — hypotheses, protocols, and its
              knowledge graph.
            </p>
          </div>
        </div>
        <div className="space-y-5 p-6">
          <div className="space-y-1.5">
            <label
              htmlFor="project-title"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Title
            </label>
            <Input
              id="project-title"
              placeholder="e.g. CRISPR base-editing in maize"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="Project title"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="project-description"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Description{' '}
              <span className="normal-case text-muted-foreground/70">· optional</span>
            </label>
            <textarea
              id="project-description"
              className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              placeholder="What question is this project chasing?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-label="Project description"
            />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Button
              type="submit"
              variant="brand"
              disabled={creating || !title.trim()}
            >
              {creating ? 'Creating…' : 'Create project'}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>
      </form>
      )}

      {authenticated && (
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Your Projects</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Projects yet.</p>
        ) : (
          <ul className="space-y-2" data-testid="project-list">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/app/projects/${p.id}`}
                  className="block rounded-md border bg-card p-4 hover:bg-muted/40"
                >
                  <span className="font-medium">{p.title}</span>
                  {p.description && (
                    <span className="block text-sm text-muted-foreground">
                      {p.description}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}
    </section>
  );
}
