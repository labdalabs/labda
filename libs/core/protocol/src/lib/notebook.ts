import { BadRequestException } from '@nestjs/common';

// Minimal nbformat 4 shapes. We store the notebook verbatim so `.ipynb`
// round-trips losslessly; these types cover what we validate/produce.
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

// A fresh, empty notebook (nbformat 4.5) with a single starter markdown cell.
export function emptyNotebook(): Notebook {
  return {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: {
        name: 'python3',
        display_name: 'Python 3',
        language: 'python',
      },
      language_info: { name: 'python' },
    },
    cells: [
      {
        cell_type: 'markdown',
        metadata: {},
        source: '# New Protocol\n',
      },
    ],
  };
}

// Validate that an arbitrary value is a well-formed nbformat-4 notebook and
// return it typed. Throws BadRequestException on malformed input.
export function parseNotebook(value: unknown): Notebook {
  const nb =
    typeof value === 'string' ? safeJsonParse(value) : (value as unknown);
  if (!nb || typeof nb !== 'object') {
    throw new BadRequestException('Notebook must be a JSON object');
  }
  const obj = nb as Record<string, unknown>;
  if (obj['nbformat'] !== 4) {
    throw new BadRequestException('Only nbformat 4 notebooks are supported');
  }
  const cells = obj['cells'];
  if (!Array.isArray(cells)) {
    throw new BadRequestException('Notebook must have a cells array');
  }
  for (const cell of cells as NotebookCell[]) {
    if (
      !cell ||
      typeof cell !== 'object' ||
      !['code', 'markdown', 'raw'].includes((cell as NotebookCell).cell_type)
    ) {
      throw new BadRequestException('Invalid notebook cell');
    }
  }
  const minor = obj['nbformat_minor'];
  return {
    nbformat: 4,
    nbformat_minor: typeof minor === 'number' ? minor : 5,
    metadata: (obj['metadata'] as Record<string, unknown>) ?? {},
    cells: cells as NotebookCell[],
    // Preserve any additional top-level nbformat fields losslessly.
    ...stripKnown(obj),
  };
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    throw new BadRequestException('Notebook is not valid JSON');
  }
}

// Return the object without the fields we set explicitly, so the spread above
// keeps unknown extras without clobbering the normalized ones.
function stripKnown(obj: Record<string, unknown>): Record<string, unknown> {
  const { nbformat, nbformat_minor, metadata, cells, ...rest } = obj;
  void nbformat;
  void nbformat_minor;
  void metadata;
  void cells;
  return rest;
}
