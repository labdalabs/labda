import type { NotebookCell } from '@/lib/protocol/types';

// nbformat-4 output objects produced by a cell execution.
export type CellOutput =
  | { output_type: 'stream'; name: 'stdout' | 'stderr'; text: string }
  | {
      output_type: 'execute_result';
      data: Record<string, unknown>;
      metadata: Record<string, unknown>;
      execution_count: number | null;
    }
  | {
      output_type: 'display_data';
      data: Record<string, unknown>;
      metadata: Record<string, unknown>;
    }
  | {
      output_type: 'error';
      ename: string;
      evalue: string;
      traceback: string[];
    };

export interface KernelVariable {
  name: string;
  type: string;
  repr: string;
}

export interface ExecuteResult {
  outputs: CellOutput[];
  executionCount: number;
}

// Swappable kernel interface (ADR-0024). The v0 implementation is an in-browser
// Pyodide runtime; a remote/hosted kernel can implement the same surface.
export interface NotebookKernel {
  ready(): Promise<void>;
  // Execute source; `onStream` fires as stdout/stderr are produced (streaming).
  execute(
    code: string,
    onStream?: (o: Extract<CellOutput, { output_type: 'stream' }>) => void,
  ): Promise<ExecuteResult>;
  variables(): Promise<KernelVariable[]>;
  reset(): Promise<void>;
}

export const CODE_CELL = (c: NotebookCell): boolean => c.cell_type === 'code';
