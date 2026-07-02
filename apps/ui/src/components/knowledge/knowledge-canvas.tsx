'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError } from '@/lib/api/client';
import {
  exportKnowledge,
  knowledgeGraph,
  linkKnowledge,
} from '@/lib/knowledge/queries';
import { useKnowledgeCanvas } from '@/lib/knowledge/store';
import type { KnowledgeNode, OkfNodeType } from '@/lib/knowledge/types';
import { GraphScene, type GraphControls } from './graph-scene';
import { ShaderBackground } from './shader-background';

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

// Elegant surface + control primitives shared by the on-canvas chrome.
const SURFACE =
  'rounded-lg border border-black/[0.07] bg-white/80 shadow-sm backdrop-blur';

function CtrlIcon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

// A short, human-readable line about a node's key attribute, for the panel.
function nodeMeta(node: KnowledgeNode): string | null {
  try {
    const a = JSON.parse(node.attributes) as Record<string, unknown>;
    switch (node.type) {
      case 'Reference':
        return typeof a.url === 'string' ? a.url : null;
      case 'Notebook':
        return typeof a.cells === 'number' ? `${a.cells} cells` : null;
      case 'Protocol':
        return typeof a.version === 'number' ? `v${a.version}` : null;
      case 'Project':
        return typeof a.description === 'string' ? a.description : null;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

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
  // Screen position of the selected node, for the anchored inline panel.
  const [selRect, setSelRect] = useState<{ x: number; y: number } | null>(null);
  // Zoom/fit controls handed up by the scene, for the on-canvas cluster.
  const [controls, setControls] = useState<GraphControls | null>(null);

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
  const selectedNode = graph?.nodes.find((n) => n.id === selectedId) ?? null;
  const selectedHref = selectedNode ? hrefFor(selectedNode, projectId) : null;

  return (
    <section
      className="relative h-full min-h-[520px] w-full overflow-hidden bg-neutral-50"
      data-testid="knowledge-canvas"
    >
      {/* Brand sky fallback beneath the shader (WebGL-less environments). */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-brand-sky via-brand-sky-light to-brand-cream"
      />
      <ShaderBackground />

      <GraphScene
        onNodeClick={handleNodeClick}
        onSelectionMove={setSelRect}
        onControls={setControls}
      />

      {/* Figma-style inline panel — anchored to the selected node, tracks
          pan/zoom. Hidden while link-picking (the list drives that flow). */}
      {selectedNode && selRect && !linkMode && (
        <div
          className="pointer-events-auto absolute z-30 w-60 -translate-x-1/2 -translate-y-full"
          style={{ left: selRect.x, top: selRect.y - 12 }}
          data-testid="node-panel"
        >
          <div className={`${SURFACE} p-3`}>
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${TYPE_DOT[selectedNode.type]}`}
              />
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {selectedNode.type}
              </span>
              <button
                type="button"
                className="ml-auto text-muted-foreground hover:text-foreground"
                onClick={() => select(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug">
              {selectedNode.label}
            </p>
            {nodeMeta(selectedNode) && (
              <p className="mt-0.5 line-clamp-2 break-words text-xs text-muted-foreground">
                {nodeMeta(selectedNode)}
              </p>
            )}
            <div className="mt-2.5 flex items-center gap-2">
              {selectedHref && (
                <Link
                  href={selectedHref}
                  className="flex-1 rounded-md bg-brand-sky px-2.5 py-1.5 text-center text-xs font-medium text-white transition-colors hover:bg-brand-sky/90"
                  data-testid="node-panel-open"
                  {...(selectedNode.type === 'Reference'
                    ? { target: '_blank', rel: 'noreferrer' }
                    : {})}
                >
                  Open
                </Link>
              )}
              <button
                type="button"
                className="rounded-md border border-black/[0.08] px-2.5 py-1.5 text-xs transition-colors hover:bg-black/[0.04]"
                onClick={() => {
                  toggleLinkMode();
                  setLinkFrom(selectedNode.id);
                }}
              >
                Link
              </button>
            </div>
            <div className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r border-black/[0.07] bg-white/80" />
          </div>
        </div>
      )}

      {/* Layers panel — the accessible, testable node list (Figma-style). */}
      <div className={`absolute left-3 top-3 z-20 w-60 ${SURFACE}`}>
        <div className="flex items-center justify-between border-b border-black/[0.06] px-3 py-2">
          <span className="text-xs font-medium">Nodes</span>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {graph ? `${graph.nodes.length} · ${graph.edges.length} edges` : '—'}
          </span>
        </div>
        <ul
          className="max-h-[36vh] space-y-0.5 overflow-auto p-1.5"
          data-testid="graph-node-list"
        >
          {loading ? (
            <li className="px-2 py-1 text-xs text-muted-foreground">Loading…</li>
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
                  className={`group flex items-center gap-2 rounded-md px-2 py-1 text-[13px] ${
                    selectedId === n.id
                      ? 'bg-black/[0.05]'
                      : hoveredId === n.id
                        ? 'bg-black/[0.03]'
                        : ''
                  } ${isFrom ? 'ring-1 ring-brand-sky' : ''}`}
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${TYPE_DOT[n.type]}`}
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
                      className="text-[11px] text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
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
        <div
          className="border-t border-black/[0.06] px-3 py-1.5 text-[11px] text-muted-foreground"
          data-testid="linked-count"
        >
          {linkedCount} user link{linkedCount === 1 ? '' : 's'}
        </div>
      </div>

      {/* Toolbar — minimal pills, top-right. */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggleLinkMode}
          data-testid="link-mode-toggle"
          className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs shadow-sm transition-colors ${
            linkMode
              ? 'bg-foreground text-background'
              : `${SURFACE} hover:bg-white`
          }`}
        >
          <CtrlIcon path="M9 15l6-6M10.5 6.5l1-1a3.5 3.5 0 0 1 5 5l-1 1M13.5 17.5l-1 1a3.5 3.5 0 0 1-5-5l1-1" />
          {linkMode ? 'Pick two…' : 'Link'}
        </button>
        <button
          type="button"
          onClick={handleExport}
          className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs shadow-sm transition-colors ${SURFACE} hover:bg-white`}
        >
          <CtrlIcon path="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
          Export
        </button>
      </div>

      {/* Zoom / fit cluster — bottom-left. */}
      <div className={`absolute bottom-3 left-3 z-20 flex flex-col overflow-hidden ${SURFACE}`}>
        {[
          { key: 'in', path: 'M12 5v14M5 12h14', fn: () => controls?.zoomIn() },
          { key: 'out', path: 'M5 12h14', fn: () => controls?.zoomOut() },
          {
            key: 'fit',
            path: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
            fn: () => controls?.reset(),
          },
        ].map((b, i) => (
          <button
            key={b.key}
            type="button"
            onClick={b.fn}
            aria-label={`zoom ${b.key}`}
            className={`flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground ${
              i > 0 ? 'border-t border-black/[0.06]' : ''
            }`}
          >
            <CtrlIcon path={b.path} />
          </button>
        ))}
      </div>

      {/* Transient status / error toast — bottom-center. */}
      {(status || error) && (
        <div
          className={`absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-md px-3 py-1.5 text-xs shadow-sm ${
            error
              ? 'bg-destructive text-white'
              : 'bg-foreground/90 text-background'
          }`}
        >
          {error || status}
        </div>
      )}
    </section>
  );
}
