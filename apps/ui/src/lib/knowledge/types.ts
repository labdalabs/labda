export type OkfNodeType =
  | 'Project'
  | 'Hypothesis'
  | 'Protocol'
  | 'Reference'
  | 'Notebook'
  | 'Analysis'
  | 'Thesis';
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
