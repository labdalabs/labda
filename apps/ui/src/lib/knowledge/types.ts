export type OkfNodeType = 'Project' | 'Hypothesis' | 'Protocol' | 'Reference';
export type OkfPredicate =
  | 'contains'
  | 'cites'
  | 'supports'
  | 'contradicts'
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
