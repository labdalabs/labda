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

// Cell-type colors come from the --node-* design tokens (global.css) — the
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

// Dark-glass instrument panels that float over the microscopy field.
const SURFACE =
  'rounded-xl border border-white/10 bg-white/[0.055] shadow-xl backdrop-blur-md';

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

// A short, human-readable line about a cell's key attribute, for the dossier.
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

// Where opening a cell navigates.
function hrefFor(node: KnowledgeNode, projectId: string): string | null {
  const localId = node.id.split(':')[1] ?? '';
  switch (node.type) {
    case 'Project':
    case 'Hypothesis':
    case 'Thesis':
      return `/app/projects/${projectId}`;
    case 'Protocol':
    case 'Notebook':
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

// The knowledge tissue: a three.js field of living cells (GraphScene) whose
// spacing encodes relatedness, plus a synced dark-glass overlay that carries
// interaction — pick a cell to focus it full-frame, open the underlying entity,
// and draw synaptic links between cells. Both read/write one zustand store.
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
        setStatus('Synapse formed');
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
  const focused = !!selectedNode && !linkMode;
  const connections = selectedNode
    ? (graph?.edges.filter(
        (e) => e.from === selectedNode.id || e.to === selectedNode.id,
      ).length ?? 0)
    : 0;

  return (
    <section
      className="relative h-full min-h-[520px] w-full overflow-hidden bg-[#060914] text-white/90"
      data-testid="knowledge-canvas"
    >
      {/* Dark field fallback beneath the shader (WebGL-less environments). */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-[#0b1020] via-[#0a0f1c] to-[#060914]"
      />
      <ShaderBackground />

      <GraphScene onNodeClick={handleNodeClick} onControls={setControls} />

      {/* Focus scrim — darkens the field edges so attention lands on the cell. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 z-10 transition-opacity duration-500 ${
          focused ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background:
            'radial-gradient(120% 90% at 50% 45%, transparent 38%, rgba(4,7,15,0.72) 100%)',
        }}
      />

      {/* Focused-cell dossier — the chosen cell, full attention. */}
      {focused && selectedNode && (
        <div
          className="pointer-events-auto absolute inset-y-0 right-0 z-30 flex w-full max-w-sm items-center p-4 sm:p-6"
          data-testid="node-panel"
        >
          <div className={`${SURFACE} w-full p-5`}>
            <div className="flex items-center gap-2.5">
              <span
                className={`h-3 w-3 shrink-0 rounded-full ${TYPE_DOT[selectedNode.type]} shadow-[0_0_12px] shadow-current`}
              />
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/55">
                {selectedNode.type}
              </span>
              <button
                type="button"
                className="ml-auto text-white/45 transition-colors hover:text-white"
                onClick={() => select(null)}
                aria-label="Back to the tissue"
              >
                ✕
              </button>
            </div>

            <h2 className="mt-3 text-xl font-semibold leading-snug tracking-tight">
              {selectedNode.label}
            </h2>
            {nodeMeta(selectedNode) && (
              <p className="mt-1.5 break-words text-sm leading-relaxed text-white/60">
                {nodeMeta(selectedNode)}
              </p>
            )}

            <div className="mt-4 flex items-center gap-2 text-xs text-white/50">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
                {connections} connection{connections === 1 ? '' : 's'}
              </span>
            </div>

            <div className="mt-5 flex items-center gap-2">
              {selectedHref && (
                <Link
                  href={selectedHref}
                  className="flex-1 rounded-lg bg-white/95 px-3 py-2 text-center text-sm font-medium text-[#0a0f1c] transition-colors hover:bg-white"
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
                className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/85 transition-colors hover:bg-white/10"
                onClick={() => {
                  toggleLinkMode();
                  setLinkFrom(selectedNode.id);
                }}
              >
                Link
              </button>
            </div>
            <p className="mt-3 text-[11px] text-white/35">
              Press Esc or click the field to return.
            </p>
          </div>
        </div>
      )}

      {/* Cells panel — the accessible, testable list. */}
      <div className={`absolute left-3 top-3 z-20 w-60 ${SURFACE}`}>
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
          <span className="text-xs font-medium text-white/80">Cells</span>
          <span className="text-[11px] tabular-nums text-white/45">
            {graph ? `${graph.nodes.length} · ${graph.edges.length} links` : '—'}
          </span>
        </div>
        <ul
          className="max-h-[36vh] space-y-0.5 overflow-auto p-1.5"
          data-testid="graph-node-list"
        >
          {loading ? (
            <li className="px-2 py-1 text-xs text-white/45">Loading…</li>
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
                      ? 'bg-white/[0.12]'
                      : hoveredId === n.id
                        ? 'bg-white/[0.07]'
                        : ''
                  } ${isFrom ? 'ring-1 ring-node-hypothesis' : ''}`}
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${TYPE_DOT[n.type]}`}
                  />
                  <button
                    type="button"
                    className="flex-1 truncate text-left text-white/85"
                    onClick={() => handleNodeClick(n)}
                    title={n.label}
                  >
                    {n.label}
                  </button>
                  {!linkMode && href && (
                    <Link
                      href={href}
                      className="text-[11px] text-white/40 opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
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
          className="border-t border-white/10 px-3 py-1.5 text-[11px] text-white/45"
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
              ? 'bg-white text-[#0a0f1c]'
              : `${SURFACE} text-white/85 hover:bg-white/10`
          }`}
        >
          <CtrlIcon path="M9 15l6-6M10.5 6.5l1-1a3.5 3.5 0 0 1 5 5l-1 1M13.5 17.5l-1 1a3.5 3.5 0 0 1-5-5l1-1" />
          {linkMode ? 'Pick two…' : 'Link'}
        </button>
        <button
          type="button"
          onClick={handleExport}
          className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-white/85 shadow-sm transition-colors ${SURFACE} hover:bg-white/10`}
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
            className={`flex h-8 w-8 items-center justify-center text-white/55 transition-colors hover:bg-white/10 hover:text-white ${
              i > 0 ? 'border-t border-white/10' : ''
            }`}
          >
            <CtrlIcon path={b.path} />
          </button>
        ))}
      </div>

      {/* Transient status / error toast — bottom-center. */}
      {(status || error) && (
        <div
          className={`absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-md px-3 py-1.5 text-xs shadow-lg ${
            error ? 'bg-destructive text-white' : 'bg-white/90 text-[#0a0f1c]'
          }`}
        >
          {error || status}
        </div>
      )}
    </section>
  );
}
