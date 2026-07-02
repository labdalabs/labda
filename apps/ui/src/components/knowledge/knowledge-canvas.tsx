'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@labda/ui/components/ui/button';
import { ApiError } from '@/lib/api/client';
import {
  exportKnowledge,
  knowledgeGraph,
  linkKnowledge,
} from '@/lib/knowledge/queries';
import { useKnowledgeCanvas } from '@/lib/knowledge/store';
import type { KnowledgeNode, OkfNodeType } from '@/lib/knowledge/types';
import { GraphScene } from './graph-scene';

const TYPE_DOT: Record<OkfNodeType, string> = {
  Project: 'bg-[#4a95cc]',
  Hypothesis: 'bg-[#8b5cf6]',
  Protocol: 'bg-[#10b981]',
  Reference: 'bg-[#f59e0b]',
};

// Where clicking a node navigates.
function hrefFor(node: KnowledgeNode, projectId: string): string | null {
  const localId = node.id.split(':')[1] ?? '';
  switch (node.type) {
    case 'Project':
    case 'Hypothesis':
      return `/app/projects/${projectId}`;
    case 'Protocol':
      return `/app/projects/${projectId}/protocols/${localId}`;
    case 'Reference': {
      try {
        const url = (JSON.parse(node.attributes).url as string) ?? '';
        return url || null;
      } catch {
        return null;
      }
    }
  }
}

// The 2D canvas: a three.js scene (GraphScene) plus a synced DOM overlay that
// carries interaction — select, open the underlying entity, and draw
// Obsidian-like links between nodes. Both read/write one zustand store.
export function KnowledgeCanvas({ projectId }: { projectId: string }) {
  const {
    graph,
    selectedId,
    linkMode,
    linkFromId,
    setGraph,
    select,
    toggleLinkMode,
    setLinkFrom,
  } = useKnowledgeCanvas();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const refresh = useCallback(async () => {
    try {
      setGraph(await knowledgeGraph(projectId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [projectId, setGraph]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleNodeClick(node: KnowledgeNode) {
    if (linkMode) {
      if (!linkFromId) {
        setLinkFrom(node.id);
        return;
      }
      if (linkFromId === node.id) {
        setLinkFrom(null);
        return;
      }
      try {
        await linkKnowledge({
          projectId,
          fromNodeId: linkFromId,
          toNodeId: node.id,
        });
        setLinkFrom(null);
        setStatus('Link created');
        await refresh();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : String(err));
      }
      return;
    }
    select(node.id);
  }

  async function handleExport() {
    setError('');
    setStatus('');
    try {
      const { url } = await exportKnowledge(projectId);
      setStatus('OKF bundle exported');
      window.open(url, '_blank');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  const linkedCount =
    graph?.edges.filter((e) => e.predicate === 'linked').length ?? 0;

  return (
    <section className="space-y-3" data-testid="knowledge-canvas">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">Knowledge graph</h2>
        <span className="text-xs text-muted-foreground">
          {graph ? `${graph.nodes.length} nodes · ${graph.edges.length} edges` : ''}
        </span>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant={linkMode ? 'default' : 'outline'}
            onClick={toggleLinkMode}
            data-testid="link-mode-toggle"
          >
            {linkMode ? 'Linking… pick two' : 'Link nodes'}
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport}>
            Export OKF
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {status && <p className="text-sm text-muted-foreground">{status}</p>}

      <div className="relative h-[420px] overflow-hidden rounded-md border bg-muted/10">
        <GraphScene />

        {/* Synced DOM overlay — the accessible, testable interaction surface. */}
        <ul
          className="absolute right-2 top-2 max-h-[400px] w-64 space-y-1 overflow-auto rounded-md border bg-background/90 p-2 text-sm"
          data-testid="graph-node-list"
        >
          {loading ? (
            <li className="text-muted-foreground">Loading…</li>
          ) : (
            graph?.nodes.map((n) => {
              const href = hrefFor(n, projectId);
              const isFrom = linkFromId === n.id;
              return (
                <li
                  key={n.id}
                  data-testid="graph-node"
                  data-node-id={n.id}
                  data-node-type={n.type}
                  className={`flex items-center gap-2 rounded px-1 py-0.5 ${
                    selectedId === n.id ? 'bg-muted' : ''
                  } ${isFrom ? 'ring-1 ring-primary' : ''}`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[n.type]}`} />
                  <button
                    type="button"
                    className="flex-1 truncate text-left"
                    onClick={() => handleNodeClick(n)}
                    title={n.label}
                  >
                    {n.label}
                  </button>
                  {!linkMode && href && (
                    <Link
                      href={href}
                      className="text-xs underline"
                      data-testid="graph-node-open"
                      {...(n.type === 'Reference'
                        ? { target: '_blank', rel: 'noreferrer' }
                        : {})}
                    >
                      open
                    </Link>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </div>

      <p className="text-xs text-muted-foreground" data-testid="linked-count">
        {linkedCount} user link{linkedCount === 1 ? '' : 's'}
      </p>
    </section>
  );
}
