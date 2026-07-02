'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@labda/ui/components/ui/button';
import { Input } from '@labda/ui/components/ui/input';
import { ApiError } from '@/lib/api/client';
import { addHypothesis, getProject } from '@/lib/research/queries';
import type { Project } from '@/lib/research/types';
import { HypothesisReferences } from './hypothesis-references';
import { ProtocolsPanel } from '@/components/protocol/protocols-panel';

export function ProjectDetail({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [statement, setStatement] = useState('');
  const [rationale, setRationale] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setProject(await getProject(projectId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!statement.trim()) return;
    setAdding(true);
    setError('');
    try {
      await addHypothesis({
        projectId,
        statement: statement.trim(),
        rationale: rationale.trim() || undefined,
      });
      setStatement('');
      setRationale('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setAdding(false);
    }
  }

  if (loading) {
    return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;
  }

  if (!project) {
    return (
      <div className="p-8">
        <p className="text-sm text-destructive">{error || 'Project not found.'}</p>
        <Link href="/app" className="text-sm underline">
          Back to Projects
        </Link>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-3xl space-y-8 p-8">
      <header className="space-y-1">
        <Link href="/app" className="text-sm text-muted-foreground underline">
          ← Projects
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{project.title}</h1>
          <div className="flex gap-3">
            <Link
              href={`/app/projects/${project.id}/assistant`}
              className="text-sm underline"
              data-testid="open-assistant"
            >
              Research agent →
            </Link>
            <Link
              href={`/app/projects/${project.id}/graph`}
              className="text-sm underline"
              data-testid="open-graph"
            >
              Knowledge graph →
            </Link>
          </div>
        </div>
        {project.description && (
          <p className="text-sm text-muted-foreground">{project.description}</p>
        )}
      </header>

      <form
        onSubmit={handleAdd}
        className="space-y-3 rounded-xl border bg-card p-6"
        data-testid="add-hypothesis-form"
      >
        <h2 className="text-lg font-semibold">Add Hypothesis</h2>
        <Input
          placeholder="The testable claim"
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          aria-label="Hypothesis statement"
          required
        />
        <textarea
          className="min-h-20 w-full rounded-md border bg-background p-2 text-sm"
          placeholder="Optional rationale"
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          aria-label="Hypothesis rationale"
        />
        <Button type="submit" disabled={adding || !statement.trim()}>
          {adding ? 'Adding…' : 'Add Hypothesis'}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Hypotheses</h2>
        {!project.hypotheses || project.hypotheses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Hypotheses yet.</p>
        ) : (
          <ul className="space-y-2" data-testid="hypothesis-list">
            {project.hypotheses.map((h) => (
              <li key={h.id} className="rounded-md border bg-card p-4">
                <p className="font-medium">{h.statement}</p>
                {h.rationale && (
                  <p className="text-sm text-muted-foreground">{h.rationale}</p>
                )}
                <HypothesisReferences hypothesisId={h.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <ProtocolsPanel projectId={project.id} />
    </section>
  );
}
