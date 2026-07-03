export type OkfNodeType =
  | 'Project'
  | 'Hypothesis'
  | 'Protocol'
  | 'Reference'
  | 'Notebook'
  | 'Analysis'
  | 'Thesis'
  // User/agent-authored node types.
  | 'Idea'
  | 'Observation'
  | 'Conclusion'
  | 'Knowledge'
  | 'Data'
  | 'Paper';

// The authored node types a user can create by hand from the graph composer.
// The derived ones — Project/Hypothesis/Protocol/Reference/Notebook/Analysis/
// Thesis — come from domain entities, not this composer. In particular a
// Notebook/Protocol is created in one place only: the Protocols panel (which
// opens the notebook editor), so it's intentionally NOT authorable here.
export const AUTHORABLE_NODE_TYPES: OkfNodeType[] = [
  'Idea',
  'Observation',
  'Conclusion',
  'Knowledge',
  'Data',
  'Paper',
];
export type OkfPredicate =
  | 'contains'
  | 'cites'
  | 'supports'
  | 'contradicts'
  | 'records'
  | 'analyzes'
  | 'linked';

export interface KnowledgeNode {
  id: string;
  type: OkfNodeType;
  label: string;
  attributes: string; // JSON string
  q?: number | null; // hex board axial coords (null = not placed yet)
  r?: number | null;
}

export interface KnowledgeEdge {
  id: string;
  from: string;
  to: string;
  predicate: OkfPredicate;
  attributes: string;
}

export interface KnowledgeGraph {
  format: string;
  rootId: string;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}
