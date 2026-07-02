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

export interface LiteratureResult {
  externalId: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  url: string | null;
  abstract: string | null;
  openAccessPdfUrl: string | null;
}

export interface Reference {
  id: string;
  hypothesisId: string;
  source: string;
  externalId: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  url: string | null;
  abstract: string | null;
  openAccessPdfUrl: string | null;
  createdAt: string;
}
