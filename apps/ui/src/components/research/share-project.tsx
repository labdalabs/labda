'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@labda/ui/components/ui/button';
import { Input } from '@labda/ui/components/ui/input';
import { ApiError } from '@/lib/api/client';
import {
  projectMembers,
  shareProject,
  type ProjectMember,
} from '@/lib/research/queries';

// Share a project with other researchers by email. Membership grants access to
// the project and its knowledge graph (they show up in presence too).
export function ShareProject({ projectId }: { projectId: string }) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setMembers(await projectMembers(projectId));
    } catch {
      /* a non-owner without list access simply sees no roster */
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleShare(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError('');
    try {
      await shareProject({ projectId, email: email.trim() });
      setEmail('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="space-y-3 rounded-xl border bg-card p-4"
      data-testid="share-panel"
    >
      <h2 className="font-heading text-sm font-semibold">Collaborators</h2>
      <ul className="flex flex-wrap gap-2" data-testid="member-list">
        {members.map((m) => (
          <li
            key={m.userId}
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-brand-sky" />
            {m.email}
            <span className="text-muted-foreground">· {m.role}</span>
          </li>
        ))}
      </ul>
      <form onSubmit={handleShare} className="flex gap-2">
        <Input
          type="email"
          placeholder="teammate@email"
          aria-label="Collaborator email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" size="sm" variant="brand" disabled={busy || !email.trim()}>
          {busy ? 'Sharing…' : 'Share'}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
