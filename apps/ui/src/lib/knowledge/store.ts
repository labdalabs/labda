import { create } from 'zustand';
import type { KnowledgeGraph } from './types';

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

// Structural predicates form the layout tree; stances (supports/contradicts)
// and user links decorate it but don't move nodes.
const TREE_PREDICATES = new Set(['contains', 'cites', 'records', 'analyzes']);

// Ring spacing between BFS depths — wide enough that rich cards have room.
const RING = 6.5;

// Radial tidy layout: BFS tree from the root over the structural predicates;
// each child gets an angular span proportional to its subtree size, placed at
// radius = depth × RING. So references cluster around their hypothesis, a
// notebook hangs off its protocol, and the graph reads as a constellation
// around the project. Deterministic (edge order), no randomness.
function layout(graph: KnowledgeGraph): Record<string, NodePosition> {
  const positions: Record<string, NodePosition> = {};
  if (!graph.nodes.length) return positions;

  // Undirected adjacency over the tree predicates (analyzes points *at* the
  // protocol but the analysis still hangs off it).
  const adj = new Map<string, string[]>();
  const push = (map: Map<string, string[]>, key: string, value: string) => {
    const list = map.get(key) ?? [];
    list.push(value);
    map.set(key, list);
  };
  for (const e of graph.edges) {
    if (!TREE_PREDICATES.has(e.predicate)) continue;
    push(adj, e.from, e.to);
    push(adj, e.to, e.from);
  }

  // BFS from the root → children per node.
  const children = new Map<string, string[]>();
  const visited = new Set([graph.rootId]);
  const queue = [graph.rootId];
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    for (const next of adj.get(cur) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      push(children, cur, next);
      queue.push(next);
    }
  }

  const sizes = new Map<string, number>();
  const size = (id: string): number => {
    const cached = sizes.get(id);
    if (cached !== undefined) return cached;
    const s = 1 + (children.get(id) ?? []).reduce((sum, c) => sum + size(c), 0);
    sizes.set(id, s);
    return s;
  };

  positions[graph.rootId] = { id: graph.rootId, x: 0, y: 0 };
  const place = (id: string, depth: number, a0: number, a1: number) => {
    const kids = children.get(id) ?? [];
    if (!kids.length) return;
    const total = kids.reduce((sum, c) => sum + size(c), 0);
    let a = a0;
    for (const kid of kids) {
      const span = ((a1 - a0) * size(kid)) / total;
      const angle = a + span / 2;
      const r = RING * (depth + 1);
      positions[kid] = {
        id: kid,
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
      };
      place(kid, depth + 1, a, a + span);
      a += span;
    }
  };
  place(graph.rootId, 0, -Math.PI / 2, Math.PI * 1.5);

  // Nodes unreachable from the root sit on an outer ring.
  const orphans = graph.nodes.filter((n) => !visited.has(n.id));
  const maxDepth =
    1 +
    Math.max(
      0,
      ...Object.values(positions).map((p) => Math.hypot(p.x, p.y) / RING),
    );
  orphans.forEach((n, i) => {
    const angle = (i / Math.max(1, orphans.length)) * Math.PI * 2;
    const r = RING * (maxDepth + 1);
    positions[n.id] = { id: n.id, x: Math.cos(angle) * r, y: Math.sin(angle) * r };
  });

  return positions;
}

export const useKnowledgeCanvas = create<KnowledgeCanvasState>((set) => ({
  graph: null,
  positions: {},
  selectedId: null,
  hoveredId: null,
  linkMode: false,
  linkFromId: null,
  setGraph: (graph) => set({ graph, positions: layout(graph) }),
  select: (id) => set({ selectedId: id }),
  hover: (id) => set({ hoveredId: id }),
  toggleLinkMode: () =>
    set((s) => ({ linkMode: !s.linkMode, linkFromId: null })),
  setLinkFrom: (id) => set({ linkFromId: id }),
}));
