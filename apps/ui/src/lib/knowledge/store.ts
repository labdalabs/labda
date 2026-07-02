import { create } from 'zustand';
import type { KnowledgeGraph, KnowledgeNode } from './types';

export interface NodePosition {
  id: string;
  x: number;
  y: number;
}

interface KnowledgeCanvasState {
  graph: KnowledgeGraph | null;
  positions: Record<string, NodePosition>;
  selectedId: string | null;
  linkMode: boolean;
  linkFromId: string | null;
  setGraph: (graph: KnowledgeGraph) => void;
  select: (id: string | null) => void;
  toggleLinkMode: () => void;
  setLinkFrom: (id: string | null) => void;
}

// Radial layout: root at the centre, other nodes spread on a ring, grouped by
// type so the graph reads clearly. Deterministic (index-based), no randomness.
function layout(graph: KnowledgeGraph): Record<string, NodePosition> {
  const positions: Record<string, NodePosition> = {};
  const others = graph.nodes.filter((n) => n.id !== graph.rootId);
  positions[graph.rootId] = { id: graph.rootId, x: 0, y: 0 };
  const radius = 6;
  others.forEach((n: KnowledgeNode, i: number) => {
    const angle = (i / Math.max(1, others.length)) * Math.PI * 2;
    positions[n.id] = {
      id: n.id,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  });
  return positions;
}

export const useKnowledgeCanvas = create<KnowledgeCanvasState>((set) => ({
  graph: null,
  positions: {},
  selectedId: null,
  linkMode: false,
  linkFromId: null,
  setGraph: (graph) => set({ graph, positions: layout(graph) }),
  select: (id) => set({ selectedId: id }),
  toggleLinkMode: () =>
    set((s) => ({ linkMode: !s.linkMode, linkFromId: null })),
  setLinkFrom: (id) => set({ linkFromId: id }),
}));
