import type { NotebookKernel } from './types';
import { getKernel as getPyodideKernel } from './pyodide-kernel';
import { makeJupyterKernel } from './jupyter-kernel';

export type KernelMode = 'pyodide' | 'jupyter';

export interface KernelSelection {
  mode: KernelMode;
  jupyterUrl?: string;
  jupyterToken?: string;
}

let jupyterKernel: NotebookKernel | null = null;
let jupyterKey = '';

// Resolve the active NotebookKernel from a selection. The in-browser Pyodide
// kernel is the default (ADR-0024); a remote Jupyter server is the hosted path
// (ADR-0027). Both satisfy the same interface, so the editor is agnostic.
export function resolveKernel(sel: KernelSelection): NotebookKernel {
  if (sel.mode === 'jupyter' && sel.jupyterUrl) {
    const key = `${sel.jupyterUrl}|${sel.jupyterToken ?? ''}`;
    if (!jupyterKernel || jupyterKey !== key) {
      jupyterKernel = makeJupyterKernel({
        baseUrl: sel.jupyterUrl,
        token: sel.jupyterToken,
      });
      jupyterKey = key;
    }
    return jupyterKernel;
  }
  return getPyodideKernel();
}

export type { NotebookKernel } from './types';
