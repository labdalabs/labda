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

// The authored node types a user can create by hand (the derived ones —
// Project/Hypothesis/Protocol/Reference/Notebook/Analysis/Thesis — come from
// domain entities, not the node composer).
export const AUTHORABLE_NODE_TYPES: OkfNodeType[] = [
  'Idea',
  'Observation',
  'Conclusion',
  'Knowledge',
  'Data',
  'Paper',
  'Notebook',
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
