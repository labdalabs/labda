'use client';

import type {
  CellOutput,
  ExecuteResult,
  KernelVariable,
  NotebookKernel,
} from './types';

const PYODIDE_VERSION = 'v0.28.3';
const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`;

// Minimal shape of the Pyodide runtime we use.
interface PyodideApi {
  runPythonAsync(code: string): Promise<unknown>;
  globals: { get(name: string): unknown };
  setStdout(opts: { batched: (s: string) => void }): void;
  setStderr(opts: { batched: (s: string) => void }): void;
}

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideApi>;
  }
}

// Python that returns a JSON string describing user-defined globals — the
// variable inspector. Filters modules, callables, and dunder names.
const INSPECT_SRC = `
import json as _json, types as _types
def _labda_inspect():
    out = []
    for _k, _v in list(globals().items()):
        if _k.startswith('_'):
            continue
        if isinstance(_v, _types.ModuleType) or callable(_v):
            continue
        try:
            _r = repr(_v)
        except Exception:
            _r = '<unrepr-able>'
        if len(_r) > 200:
            _r = _r[:200] + '…'
        out.append({'name': _k, 'type': type(_v).__name__, 'repr': _r})
    return _json.dumps(out)
_labda_inspect()
`;

// In-browser Pyodide kernel (ADR-0024). Singleton per page; lazy-loads the
// runtime on first use.
class PyodideKernel implements NotebookKernel {
  private pyodide?: PyodideApi;
  private loading?: Promise<void>;
  private executionCount = 0;
  private streamSink: ((name: 'stdout' | 'stderr', text: string) => void) | null =
    null;

  async ready(): Promise<void> {
    if (this.pyodide) return;
    if (!this.loading) this.loading = this.load();
    await this.loading;
  }

  private async load(): Promise<void> {
    if (!window.loadPyodide) {
      await injectScript(`${PYODIDE_INDEX_URL}pyodide.js`);
    }
    if (!window.loadPyodide) {
      throw new Error('Failed to load the Pyodide runtime');
    }
    const py = await window.loadPyodide({ indexURL: PYODIDE_INDEX_URL });
    py.setStdout({
      batched: (s: string) => this.streamSink?.('stdout', s),
    });
    py.setStderr({
      batched: (s: string) => this.streamSink?.('stderr', s),
    });
    this.pyodide = py;
  }

  async execute(
    code: string,
    onStream?: (o: Extract<CellOutput, { output_type: 'stream' }>) => void,
  ): Promise<ExecuteResult> {
    await this.ready();
    const py = this.pyodide!;
    const outputs: CellOutput[] = [];
    this.executionCount += 1;

    this.streamSink = (name, text) => {
      const out = { output_type: 'stream', name, text } as Extract<
        CellOutput,
        { output_type: 'stream' }
      >;
      outputs.push(out);
      onStream?.(out);
    };

    try {
      const result = await py.runPythonAsync(code);
      const rendered = this.renderResult(result);
      if (rendered !== null) {
        outputs.push({
          output_type: 'execute_result',
          data: { 'text/plain': rendered },
          metadata: {},
          execution_count: this.executionCount,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const lines = message.split('\n');
      outputs.push({
        output_type: 'error',
        ename: lines[0]?.split(':')[0] ?? 'Error',
        evalue: lines[lines.length - 1] ?? message,
        traceback: lines,
      });
    } finally {
      this.streamSink = null;
    }

    return { outputs, executionCount: this.executionCount };
  }

  async variables(): Promise<KernelVariable[]> {
    if (!this.pyodide) return [];
    try {
      const json = (await this.pyodide.runPythonAsync(INSPECT_SRC)) as string;
      return JSON.parse(json) as KernelVariable[];
    } catch {
      return [];
    }
  }

  async reset(): Promise<void> {
    if (!this.pyodide) return;
    await this.pyodide.runPythonAsync(
      "for _k in [k for k in list(globals()) if not k.startswith('_')]:\n" +
        '    del globals()[_k]',
    );
    this.executionCount = 0;
  }

  private renderResult(result: unknown): string | null {
    if (result === undefined || result === null) return null;
    // Pyodide returns proxies for Python objects; str() them via repr fallback.
    const asString =
      typeof result === 'object' && result !== null && 'toString' in result
        ? String(result)
        : JSON.stringify(result);
    return asString === 'undefined' ? null : asString;
  }
}

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

let singleton: PyodideKernel | null = null;

export function getKernel(): NotebookKernel {
  if (!singleton) singleton = new PyodideKernel();
  return singleton;
}
