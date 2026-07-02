import { create } from 'zustand';
import type { KnowledgeGraph, OkfPredicate } from './types';

export interface NodePosition {
  id: string;
  x: number;
  y: number;
}

interface KnowledgeCanvasState {
  graph: KnowledgeGraph | null;
  positions: Record<string, NodePosition>;
  selectedId: string | null;
  hoveredId: string | null;
  linkMode: boolean;
  linkFromId: string | null;
  setGraph: (graph: KnowledgeGraph) => void;
  select: (id: string | null) => void;
  hover: (id: string | null) => void;
  toggleLinkMode: () => void;
  setLinkFrom: (id: string | null) => void;
}

// How tightly each relation pulls two cells together. `rest` is the ideal
// distance between connected cells (shorter → closer → reads as *more
// related*); `k` is the spring stiffness. A shared stance (supports/
// contradicts) or a hand-drawn link means "these are about the same thing", so
// they sit closest; structural containment sits mid; a citation is a looser tie.
const RELATION: Record<OkfPredicate, { rest: number; k: number }> = {
  linked: { rest: 3.6, k: 0.09 },
  supports: { rest: 3.9, k: 0.09 },
  contradicts: { rest: 4.3, k: 0.085 }, // opposed, but about the same claim
  contains: { rest: 4.8, k: 0.07 },
  records: { rest: 4.4, k: 0.075 },
  analyzes: { rest: 4.6, k: 0.075 },
  cites: { rest: 6.2, k: 0.045 },
};

// Force-directed layout: cells repel each other (so nothing overlaps) while
// every relation pulls its two cells toward that relation's rest distance.
// Related cells therefore drift into tight ganglia and unrelated ones spread
// apart — proximity *is* relatedness. Fully deterministic (golden-angle seed,
// fixed iteration count, no randomness) so the tissue looks the same each load
// and tests stay stable.
function forceLayout(graph: KnowledgeGraph): Record<string, NodePosition> {
  const nodes = graph.nodes;
  const n = nodes.length;
  const out: Record<string, NodePosition> = {};
  if (!n) return out;

  const idx = new Map(nodes.map((node, i) => [node.id, i]));
  const px = new Float64Array(n);
  const py = new Float64Array(n);
  const dx = new Float64Array(n);
  const dy = new Float64Array(n);

  // Seed on a golden-angle spiral so initial spacing is even and deterministic.
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const r = 2.2 * Math.sqrt(i + 0.5);
    px[i] = Math.cos(i * GOLDEN) * r;
    py[i] = Math.sin(i * GOLDEN) * r;
  }
  // Pin the root at the origin as the tissue's anchor.
  const rootI = idx.get(graph.rootId);
  if (rootI !== undefined) {
    px[rootI] = 0;
    py[rootI] = 0;
  }

  const springs = graph.edges
    .map((e) => {
      const a = idx.get(e.from);
      const b = idx.get(e.to);
      if (a === undefined || b === undefined || a === b) return null;
      return { a, b, ...(RELATION[e.predicate] ?? RELATION.cites) };
    })
    .filter((s): s is { a: number; b: number; rest: number; k: number } => !!s);

  const REPULSION = 26;
  const CENTER = 0.022;
  const ITERS = 480;
  for (let it = 0; it < ITERS; it++) {
    const alpha = Math.max(0.02, 1 - it / ITERS); // cool down
    dx.fill(0);
    dy.fill(0);

    // Repulsion between every pair (charge ~ 1/dist).
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let ox = px[i] - px[j];
        let oy = py[i] - py[j];
        let d2 = ox * ox + oy * oy;
        if (d2 < 0.01) {
          ox = (i - j) * 0.01 + 0.001;
          oy = 0.01;
          d2 = ox * ox + oy * oy;
        }
        const d = Math.sqrt(d2);
        const f = REPULSION / d2;
        dx[i] += (ox / d) * f;
        dy[i] += (oy / d) * f;
        dx[j] -= (ox / d) * f;
        dy[j] -= (oy / d) * f;
      }
    }

    // Springs pull related cells toward their rest distance.
    for (const s of springs) {
      const ox = px[s.b] - px[s.a];
      const oy = py[s.b] - py[s.a];
      const d = Math.hypot(ox, oy) || 0.01;
      const f = s.k * (d - s.rest);
      const fx = (ox / d) * f;
      const fy = (oy / d) * f;
      dx[s.a] += fx;
      dy[s.a] += fy;
      dx[s.b] -= fx;
      dy[s.b] -= fy;
    }

    // Gentle pull to the origin keeps the tissue compact and centered.
    for (let i = 0; i < n; i++) {
      dx[i] -= px[i] * CENTER;
      dy[i] -= py[i] * CENTER;
    }

    // Integrate with a cooling, clamped step; keep the root pinned.
    const maxStep = 2.4 * alpha;
    for (let i = 0; i < n; i++) {
      if (i === rootI) continue;
      const step = Math.hypot(dx[i], dy[i]);
      const s = step > maxStep ? maxStep / step : 1;
      px[i] += dx[i] * s;
      py[i] += dy[i] * s;
    }
  }

  for (let i = 0; i < n; i++) {
    out[nodes[i].id] = { id: nodes[i].id, x: px[i], y: py[i] };
  }
  return out;
}

export const useKnowledgeCanvas = create<KnowledgeCanvasState>((set) => ({
  graph: null,
  positions: {},
  selectedId: null,
  hoveredId: null,
  linkMode: false,
  linkFromId: null,
  setGraph: (graph) => set({ positions: forceLayout(graph), graph }),
  select: (id) => set({ selectedId: id }),
  hover: (id) => set({ hoveredId: id }),
  toggleLinkMode: () =>
    set((s) => ({ linkMode: !s.linkMode, linkFromId: null })),
  setLinkFrom: (id) => set({ linkFromId: id }),
}));
