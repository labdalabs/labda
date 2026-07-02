'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@labda/ui/components/ui/button';
import { Input } from '@labda/ui/components/ui/input';
import { ApiError } from '@/lib/api/client';
import { createProtocol, listProtocols } from '@/lib/protocol/queries';
import type { Protocol } from '@/lib/protocol/types';

// Protocols under a Project: list them, create a new one (opens the editor).
export function ProtocolsPanel({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setProtocols(await listProtocols(projectId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError('');
    try {
      const p = await createProtocol({ projectId, title: title.trim() });
      router.push(`/app/projects/${projectId}/protocols/${p.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
      setCreating(false);
    }
  }

  return (
    <section className="space-y-2" data-testid="protocols-panel">
      <h2 className="text-lg font-semibold">Protocols</h2>
      <form onSubmit={handleCreate} className="flex gap-2">
        <Input
          placeholder="New Protocol title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Protocol title"
        />
        <Button type="submit" size="sm" disabled={creating || !title.trim()}>
          {creating ? 'Creating…' : 'Create Protocol'}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {protocols.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Protocols yet.</p>
      ) : (
        <ul className="space-y-2" data-testid="protocol-list">
          {protocols.map((p) => (
            <li key={p.id}>
              <Link
                href={`/app/projects/${projectId}/protocols/${p.id}`}
                className="block rounded-md border bg-card p-3 hover:bg-muted/40"
              >
                <span className="font-medium">{p.title}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  v{p.version}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
