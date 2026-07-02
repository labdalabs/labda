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

// Node-type colors come from the --node-* design tokens (global.css) — the
// same palette the three.js scene reads.
const TYPE_DOT: Record<OkfNodeType, string> = {
  Project: 'bg-node-project',
  Hypothesis: 'bg-node-hypothesis',
  Protocol: 'bg-node-protocol',
  Reference: 'bg-node-reference',
  Notebook: 'bg-node-notebook',
  Analysis: 'bg-node-analysis',
  Thesis: 'bg-node-thesis',
};

const NODE_TYPES = Object.keys(TYPE_DOT) as OkfNodeType[];

// The landing page's fractal-noise grain, reused so the canvas reads as the
// same material as the brand gradient.
const NOISE_URI =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

// Where clicking a node navigates.
function hrefFor(node: KnowledgeNode, projectId: string): string | null {
  const localId = node.id.split(':')[1] ?? '';
  switch (node.type) {
    case 'Project':
    case 'Hypothesis':
    case 'Thesis':
      return `/app/projects/${projectId}`;
    case 'Protocol':
    case 'Notebook':
      // The Notebook is a Protocol's computational record — same editor.
      return `/app/projects/${projectId}/protocols/${localId}`;
    case 'Analysis': {
      try {
        const protocolId =
          (JSON.parse(node.attributes).protocolId as string) ?? '';
        return protocolId
          ? `/app/projects/${projectId}/protocols/${protocolId}`
          : null;
      } catch {
        return null;
      }
    }
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
// Obsidian-like links between nodes. Both read/write one zustand store, and
// clicking a node inside the scene routes through the same handler as the
// overlay list.
export function KnowledgeCanvas({ projectId }: { projectId: string }) {
  const {
    graph,
    selectedId,
    hoveredId,
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
  const presentTypes = NODE_TYPES.filter((t) =>
    graph?.nodes.some((n) => n.type === t),
  );

  return (
    <section className="space-y-3" data-testid="knowledge-canvas">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-heading text-lg font-semibold">Knowledge graph</h2>
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

      <div className="relative h-[480px] overflow-hidden rounded-xl border shadow-sm">
        {/* The brand sky — same gradient as the landing page. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-brand-sky via-brand-sky-light to-brand-cream"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-overlay"
          style={{ backgroundImage: NOISE_URI }}
        />

        <GraphScene onNodeClick={handleNodeClick} />

        {/* Synced DOM overlay — the accessible, testable interaction surface. */}
        <ul
          className="absolute right-2 top-2 max-h-[calc(100%-1rem)] w-64 space-y-1 overflow-auto rounded-lg border border-white/40 bg-background/85 p-2 text-sm shadow-sm backdrop-blur"
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
                  } ${hoveredId === n.id ? 'bg-muted/60' : ''} ${
                    isFrom ? 'ring-1 ring-primary' : ''
                  }`}
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[n.type]}`}
                  />
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

        {/* Legend — the node types present in this graph. */}
        {presentTypes.length > 0 && (
          <div
            className="absolute bottom-2 left-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-white/40 bg-background/85 px-2.5 py-1.5 text-xs shadow-sm backdrop-blur"
            data-testid="graph-legend"
          >
            {presentTypes.map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${TYPE_DOT[t]}`} />
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground" data-testid="linked-count">
        {linkedCount} user link{linkedCount === 1 ? '' : 's'}
      </p>
    </section>
  );
}
