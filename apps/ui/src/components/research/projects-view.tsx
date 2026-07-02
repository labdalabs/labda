'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@labda/ui/components/ui/button';
import { Input } from '@labda/ui/components/ui/input';
import { ApiError } from '@/lib/api/client';
import { createProject, listProjects } from '@/lib/research/queries';
import type { Project } from '@/lib/research/types';

export function ProjectsView({ email }: { email: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
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
    void refresh();
  }, [refresh]);

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
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
        <form method="POST" action="/auth/sign-out">
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </header>

      <form
        onSubmit={handleCreate}
        className="space-y-3 rounded-xl border bg-card p-6"
        data-testid="create-project-form"
      >
        <h2 className="text-lg font-semibold">New Project</h2>
        <Input
          placeholder="Project title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Project title"
          required
        />
        <textarea
          className="min-h-20 w-full rounded-md border bg-background p-2 text-sm"
          placeholder="Optional description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-label="Project description"
        />
        <Button type="submit" disabled={creating || !title.trim()}>
          {creating ? 'Creating…' : 'Create Project'}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>

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
    </section>
  );
}
