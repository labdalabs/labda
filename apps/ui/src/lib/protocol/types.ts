export interface NotebookCell {
  cell_type: 'code' | 'markdown' | 'raw';
  source: string | string[];
  metadata?: Record<string, unknown>;
  outputs?: unknown[];
  execution_count?: number | null;
  [key: string]: unknown;
}

export interface Notebook {
  nbformat: number;
  nbformat_minor: number;
  metadata: Record<string, unknown>;
  cells: NotebookCell[];
  [key: string]: unknown;
}

export interface Protocol {
  id: string;
  projectId: string;
  title: string;
  version: number;
  notebook: string; // nbformat-4 JSON string
  createdAt: string;
  updatedAt: string;
}

// Normalize nbformat `source` (string | string[]) to a single string.
export function cellText(cell: NotebookCell): string {
  return Array.isArray(cell.source) ? cell.source.join('') : cell.source;
}
