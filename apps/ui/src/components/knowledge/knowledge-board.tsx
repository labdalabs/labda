'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@labda/ui/components/ui/button';
import { ApiError } from '@/lib/api/client';
import { usePresence } from '@/lib/knowledge/use-presence';
import {
  createKnowledgeNode,
  deleteKnowledgeNode,
  knowledgeGraph,
  linkKnowledge,
  setNodePosition,
  unlinkKnowledge,
  updateKnowledgeNode,
} from '@/lib/knowledge/queries';
import {
  AUTHORABLE_NODE_TYPES,
  type KnowledgeEdge,
  type KnowledgeGraph,
  type KnowledgeNode,
  type OkfNodeType,
} from '@/lib/knowledge/types';

// A hex cell's fill/edge colour, from the --node-* design tokens.
const TYPE_VAR: Record<OkfNodeType, string> = {
  Project: '--node-project',
  Hypothesis: '--node-hypothesis',
  Protocol: '--node-protocol',
  Reference: '--node-reference',
  Notebook: '--node-notebook',
  Analysis: '--node-analysis',
  Thesis: '--node-thesis',
  Idea: '--node-idea',
  Observation: '--node-observation',
  Conclusion: '--node-conclusion',
  Knowledge: '--node-knowledge',
  Data: '--node-data',
  Paper: '--node-paper',
};

const SIZE = 48; // hex "radius"
const HEX_W = Math.sqrt(3) * SIZE;
const HEX_H = 2 * SIZE;
const CLIP = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';
const DIRS: [number, number][] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

function axialToPixel(q: number, r: number) {
  return { x: HEX_W * (q + r / 2), y: (3 / 2) * SIZE * r };
}
const hkey = (q: number, r: number) => `${q},${r}`;

function parseAttr(item: { attributes: string }): Record<string, unknown> {
  try {
    return JSON.parse(item.attributes) as Record<string, unknown>;
  } catch {
    return {};
  }
}
function nodeContent(n: KnowledgeNode): string | null {
  const c = parseAttr(n)['content'];
  return typeof c === 'string' && c.trim() ? c : null;
}
function isAuthored(n: KnowledgeNode): boolean {
  return n.id.startsWith('node:');
}

// The hexagonal knowledge board: nodes are hex cells you drag onto the grid to
// build islands of knowledge; placing two side by side links them. Click a cell
// to open its details in a right-side panel (edit / unlink / remove).
export function KnowledgeBoard({ projectId }: { projectId: string }) {
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [pos, setPos] = useState<Record<string, { q: number; r: number }>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [composing, setComposing] = useState(false);
  const [nodeType, setNodeType] = useState<OkfNodeType>('Idea');
  const [nodeTitle, setNodeTitle] = useState('');
  const boardRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const g = await knowledgeGraph(projectId);
      setGraph(g);
      setPos((prev) => {
        const next = { ...prev };
        for (const n of g.nodes) {
          if (typeof n.q === 'number' && typeof n.r === 'number') {
            next[n.id] = { q: n.q, r: n.r };
          }
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const nodes = graph?.nodes ?? [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const placed = nodes.filter((n) => pos[n.id]);
  const tray = nodes.filter((n) => !pos[n.id]);
  const occupied = new Map<string, string>(); // "q,r" -> nodeId
  for (const n of placed) occupied.set(hkey(pos[n.id].q, pos[n.id].r), n.id);

  // Empty hexes adjacent to any placed node are the drop zones (grow islands);
  // the origin seeds an empty board.
  const dropZones = new Map<string, { q: number; r: number }>();
  if (placed.length === 0) dropZones.set(hkey(0, 0), { q: 0, r: 0 });
  for (const n of placed) {
    const { q, r } = pos[n.id];
    for (const [dq, dr] of DIRS) {
      const nq = q + dq;
      const nr = r + dr;
      const k = hkey(nq, nr);
      if (!occupied.has(k)) dropZones.set(k, { q: nq, r: nr });
    }
  }

  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;

  // Live presence: who else is on this board, and which node each is focused on.
  const others = usePresence(projectId, selectedId);
  const presenceByNode = new Map<string, typeof others>();
  for (const p of others) {
    if (!p.nodeId) continue;
    const list = presenceByNode.get(p.nodeId) ?? [];
    list.push(p);
    presenceByNode.set(p.nodeId, list);
  }

  async function placeNode(nodeId: string, q: number, r: number) {
    setPos((p) => ({ ...p, [nodeId]: { q, r } }));
    setError('');
    try {
      await setNodePosition({ projectId, nodeId, q, r });
      // Adjacency = link: connect to any occupied neighbour not already linked.
      const linkedIds = new Set(
        (graph?.edges ?? [])
          .filter((e) => e.from === nodeId || e.to === nodeId)
          .map((e) => (e.from === nodeId ? e.to : e.from)),
      );
      for (const [dq, dr] of DIRS) {
        const neighbourId = occupied.get(hkey(q + dq, r + dr));
        if (neighbourId && neighbourId !== nodeId && !linkedIds.has(neighbourId)) {
          await linkKnowledge({
            projectId,
            fromNodeId: nodeId,
            toNodeId: neighbourId,
          });
        }
      }
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!nodeTitle.trim()) return;
    try {
      await createKnowledgeNode({
        projectId,
        type: nodeType,
        title: nodeTitle.trim(),
      });
      setNodeTitle('');
      setComposing(false);
      setStatus('Node added — drag it onto the board');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  // Background drag pans the board.
  const panRef = useRef<{ x: number; y: number } | null>(null);
  function onBgDown(e: React.PointerEvent) {
    if (e.target !== boardRef.current) return;
    panRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  }
  function onBgMove(e: React.PointerEvent) {
    if (!panRef.current) return;
    setPan({ x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y });
  }
  function onBgUp() {
    panRef.current = null;
  }

  return (
    <section
      className="relative flex h-full min-h-[520px] w-full overflow-hidden bg-[#070b14] text-white/90"
      data-testid="knowledge-canvas"
    >
      {/* Who's here — live participants on this board. */}
      {others.length > 0 && (
        <div
          className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-1.5"
          data-testid="presence-strip"
        >
          {others.map((p) => (
            <span
              key={p.userId}
              title={`${p.name}${p.nodeId ? ' · focused on a cell' : ''}`}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-white/25 bg-emerald-400/20 text-[10px] font-semibold text-white/90 shadow-sm"
            >
              {p.name.slice(0, 2).toUpperCase()}
            </span>
          ))}
        </div>
      )}

      {/* Board */}
      <div
        ref={boardRef}
        className="relative flex-1 cursor-grab touch-none overflow-hidden active:cursor-grabbing"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 40%, rgba(30,45,80,0.5), transparent 60%)',
        }}
        onPointerDown={onBgDown}
        onPointerMove={onBgMove}
        onPointerUp={onBgUp}
        onPointerLeave={onBgUp}
        data-testid="hex-board"
      >
        <div
          className="pointer-events-none absolute left-1/2 top-1/2"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
        >
          {/* Drop zones */}
          {[...dropZones.values()].map(({ q, r }) => {
            const { x, y } = axialToPixel(q, r);
            return (
              <div
                key={`z${hkey(q, r)}`}
                className="pointer-events-auto absolute rounded-[6px] border-2 border-dashed border-white/15 bg-white/[0.02] transition-colors hover:border-white/40 hover:bg-white/[0.06]"
                style={{
                  width: HEX_W,
                  height: HEX_H,
                  left: x - HEX_W / 2,
                  top: y - HEX_H / 2,
                  clipPath: CLIP,
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData('nodeId');
                  if (id) void placeNode(id, q, r);
                }}
                data-testid="hex-drop"
              />
            );
          })}

          {/* Placed nodes */}
          {placed.map((n) => {
            const { q, r } = pos[n.id];
            const { x, y } = axialToPixel(q, r);
            const color = `var(${TYPE_VAR[n.type]})`;
            const sel = selectedId === n.id;
            return (
              <button
                key={n.id}
                type="button"
                draggable
                onDragStart={(e) => e.dataTransfer.setData('nodeId', n.id)}
                onClick={() => setSelectedId(n.id)}
                className="pointer-events-auto absolute flex flex-col items-center justify-center p-2 text-center transition-transform hover:z-10 hover:scale-[1.04]"
                style={{
                  width: HEX_W,
                  height: HEX_H,
                  left: x - HEX_W / 2,
                  top: y - HEX_H / 2,
                  clipPath: CLIP,
                  background: `linear-gradient(160deg, color-mix(in srgb, ${color} 34%, #0a0f1c), color-mix(in srgb, ${color} 14%, #0a0f1c))`,
                  boxShadow: sel
                    ? `0 0 0 3px #fff, 0 0 22px ${color}`
                    : `inset 0 0 0 2px color-mix(in srgb, ${color} 70%, transparent)`,
                }}
                data-testid="graph-node"
                data-node-id={n.id}
                data-node-type={n.type}
                title={n.label}
              >
                <span
                  className="line-clamp-3 px-1 text-[11px] font-medium leading-tight text-white/95"
                  style={{ textShadow: '0 1px 3px rgba(0,0,0,.8)' }}
                >
                  {n.label}
                </span>
              </button>
            );
          })}

          {/* Presence: badge on cells others are focused on (unclipped). */}
          {placed
            .filter((n) => presenceByNode.has(n.id))
            .map((n) => {
              const { q, r } = pos[n.id];
              const { x, y } = axialToPixel(q, r);
              return (
                <span
                  key={`p${n.id}`}
                  data-testid="node-presence"
                  title={`${presenceByNode
                    .get(n.id)!
                    .map((p) => p.name)
                    .join(', ')} viewing`}
                  className="pointer-events-none absolute z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-400 px-1 text-[9px] font-bold text-[#0a0f1c]"
                  style={{ left: x + HEX_W / 2 - 14, top: y - HEX_H / 2 + 6 }}
                >
                  {presenceByNode.get(n.id)!.length}
                </span>
              );
            })}
        </div>
      </div>

      {/* Tray of unplaced nodes */}
      <div className="absolute left-3 top-3 z-20 flex max-h-[70vh] w-56 flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.055] shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
          <span className="text-xs font-medium text-white/80">Nodes to place</span>
          <button
            type="button"
            onClick={() => setComposing((v) => !v)}
            className="rounded-md px-1.5 text-sm text-white/70 hover:bg-white/10 hover:text-white"
            data-testid="add-node-toggle"
            aria-label="New node"
          >
            +
          </button>
        </div>
        {composing && (
          <form
            onSubmit={handleCreate}
            className="space-y-2 border-b border-white/10 p-2"
            data-testid="node-composer"
          >
            <div className="flex flex-wrap gap-1">
              {AUTHORABLE_NODE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNodeType(t)}
                  aria-pressed={nodeType === t}
                  className={`rounded-full border px-2 py-0.5 text-[10px] ${
                    nodeType === t
                      ? 'border-white/30 bg-white/15 text-white'
                      : 'border-white/10 text-white/60'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <input
              className="w-full rounded-md border border-white/15 bg-white/5 px-2 py-1 text-sm text-white outline-none placeholder:text-white/35"
              placeholder="Title"
              aria-label="Node title"
              value={nodeTitle}
              onChange={(e) => setNodeTitle(e.target.value)}
              autoFocus
            />
            <Button type="submit" size="sm" disabled={!nodeTitle.trim()} className="w-full">
              Add
            </Button>
          </form>
        )}
        <ul className="flex-1 space-y-1 overflow-auto p-2" data-testid="node-tray">
          {loading ? (
            <li className="text-xs text-white/45">Loading…</li>
          ) : tray.length === 0 ? (
            <li className="text-xs text-white/45">All nodes placed.</li>
          ) : (
            tray.map((n) => (
              <li
                key={n.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('nodeId', n.id)}
                className="flex cursor-grab items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[12px] text-white/85 active:cursor-grabbing"
                data-testid="tray-node"
                data-node-type={n.type}
                title={n.label}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: `var(${TYPE_VAR[n.type]})` }}
                />
                <span className="truncate">{n.label}</span>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Right detail panel (Railway-style) */}
      {selected && (
        <NodePanel
          key={selected.id}
          node={selected}
          edges={graph?.edges ?? []}
          byId={byId}
          projectId={projectId}
          onClose={() => setSelectedId(null)}
          onChanged={refresh}
          onError={setError}
        />
      )}

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

function NodePanel({
  node,
  edges,
  byId,
  projectId,
  onClose,
  onChanged,
  onError,
}: {
  node: KnowledgeNode;
  edges: KnowledgeEdge[];
  byId: Map<string, KnowledgeNode>;
  projectId: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(node.label);
  const [content, setContent] = useState(nodeContent(node) ?? '');
  const [busy, setBusy] = useState(false);
  const authored = isAuthored(node);

  const links = edges
    .filter(
      (e) =>
        e.predicate === 'linked' && (e.from === node.id || e.to === node.id),
    )
    .map((e) => ({
      edge: e,
      other: byId.get(e.from === node.id ? e.to : e.from),
    }))
    .filter((l): l is { edge: KnowledgeEdge; other: KnowledgeNode } => !!l.other);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    onError('');
    try {
      await fn();
      await onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="absolute inset-y-0 right-0 z-30 flex w-full max-w-sm flex-col border-l border-white/10 bg-[#0b1020]/95 shadow-2xl backdrop-blur-md"
      data-testid="node-panel"
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span
          className="h-3 w-3 rounded-full"
          style={{ background: `var(${TYPE_VAR[node.type]})` }}
        />
        <span className="text-[11px] uppercase tracking-[0.18em] text-white/55">
          {node.type}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto text-white/45 hover:text-white"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-auto p-4">
        {editing ? (
          <input
            className="w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-lg font-semibold text-white outline-none"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Edit title"
          />
        ) : (
          <h2 className="text-xl font-semibold leading-snug">{node.label}</h2>
        )}

        {editing ? (
          <textarea
            className="min-h-40 w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/90 outline-none"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            aria-label="Edit content"
            placeholder="Markdown…"
          />
        ) : (
          nodeContent(node) && (
            <div
              className="whitespace-pre-wrap text-sm leading-relaxed text-white/75"
              data-testid="node-content"
            >
              {nodeContent(node)}
            </div>
          )
        )}

        {links.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wide text-white/40">
              Linked
            </p>
            {links.map(({ edge, other }) => (
              <div
                key={edge.id}
                className="flex items-center gap-2 rounded-md border border-white/10 px-2 py-1 text-xs"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: `var(${TYPE_VAR[other.type]})` }}
                />
                <span className="flex-1 truncate">{other.label}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      unlinkKnowledge(
                        (parseAttr(edge)['linkId'] as string) ?? edge.id,
                      ),
                    )
                  }
                  className="text-white/40 hover:text-destructive"
                  data-testid="unlink"
                >
                  unlink
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-white/10 p-4">
        {authored ? (
          editing ? (
            <>
              <Button
                size="sm"
                disabled={busy || !title.trim()}
                onClick={() =>
                  run(async () => {
                    await updateKnowledgeNode({
                      id: node.id.replace(/^node:/, ''),
                      title: title.trim(),
                      content,
                    });
                    setEditing(false);
                  })
                }
              >
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )
        ) : (
          <span className="text-[11px] text-white/40">Derived from a project entity.</span>
        )}
        {authored && !editing && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(() => deleteKnowledgeNode(node.id.replace(/^node:/, ''))).then(onClose)
            }
            className="ml-auto rounded-md px-2.5 py-1.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
            data-testid="delete-node"
          >
            Remove
          </button>
        )}
        {!authored && (
          <Link
            href={`/app/projects/${projectId}`}
            className="ml-auto text-xs text-white/60 underline"
          >
            Open entity
          </Link>
        )}
      </div>
    </div>
  );
}
