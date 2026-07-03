'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@labda/ui/components/ui/button';
import {
  knowledgeGraph,
  okfFile,
  updateKnowledgeNode,
} from '@/lib/knowledge/queries';
import { useWorkspace, type WorkspaceTab } from '@/lib/workspace/store';

// A view of one OKF markdown file from the real bundle. The rendered file is
// read-only; author-first files (nodes/*.md) can be edited — which edits the
// node's markdown *body* (the source of truth), after which the file re-renders.
export function OkfFileView({ tab }: { tab: WorkspaceTab }) {
  const projectId = useWorkspace((s) => s.projectId);
  const bumpGraph = useWorkspace((s) => s.bumpGraph);
  const [content, setContent] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!projectId || !tab.filePath) return;
    try {
      const f = await okfFile(projectId, tab.filePath);
      setContent(f.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [projectId, tab.filePath]);

  useEffect(() => {
    void load();
  }, [load]);

  async function beginEdit() {
    setError('');
    // Seed the editor from the node's body (not the rendered file), so saving
    // doesn't fold frontmatter/links back into the content.
    let body = '';
    try {
      if (projectId && tab.nodeId) {
        const g = await knowledgeGraph(projectId);
        const node = g.nodes.find((n) => n.id === `node:${tab.nodeId}`);
        if (node) {
          const attrs = JSON.parse(node.attributes) as { content?: unknown };
          if (typeof attrs.content === 'string') body = attrs.content;
        }
      }
    } catch {
      /* fall back to empty body */
    }
    setDraft(body);
    setEditing(true);
  }

  async function save() {
    if (!tab.nodeId) return;
    setBusy(true);
    setError('');
    try {
      await updateKnowledgeNode({ id: tab.nodeId, content: draft });
      setEditing(false);
      await load();
      bumpGraph();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4 p-8" data-testid="okf-file">
      <header className="flex items-start justify-between gap-4 border-b pb-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate font-mono text-xs text-muted-foreground">
            {tab.filePath}
          </p>
          <h1 className="font-heading text-xl font-semibold">{tab.title}</h1>
        </div>
        {tab.editable && !editing && (
          <Button
            size="sm"
            variant="outline"
            onClick={beginEdit}
            data-testid="edit-file"
          >
            Edit
          </Button>
        )}
      </header>

      {editing ? (
        <div className="space-y-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="File content"
            className="min-h-[24rem] w-full rounded-md border bg-background px-3 py-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={save} data-testid="save-file">
              {busy ? 'Saving…' : 'Save'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : content === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
          {content}
        </pre>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
