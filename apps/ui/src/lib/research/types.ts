export interface Hypothesis {
  id: string;
  projectId: string;
  statement: string;
  rationale: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  hypotheses?: Hypothesis[];
}
