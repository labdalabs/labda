'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@labda/ui/components/ui/button';
import { Input } from '@labda/ui/components/ui/input';
import { ApiError } from '@/lib/api/client';
import { getProtocol, saveProtocol } from '@/lib/protocol/queries';
import { cellText, type Notebook, type NotebookCell } from '@/lib/protocol/types';
import { resolveKernel, type KernelMode } from '@/lib/kernel';
import type { CellOutput, KernelVariable } from '@/lib/kernel/types';
import { CellOutputs } from './cell-output';
import { AnalysisPanel } from './analysis-panel';
import { PythonEditor } from './python-editor';
import { CopilotThread } from '@/components/copilot/copilot-thread';

// Kernel status chip — a colored dot + label, in semantic token colors.
const KERNEL_CHIP: Record<KernelStatus, { dot: string; text: string }> = {
  idle: { dot: 'bg-muted-foreground/50', text: 'text-muted-foreground' },
  loading: { dot: 'bg-warning animate-pulse', text: 'text-muted-foreground' },
  ready: { dot: 'bg-success', text: 'text-foreground' },
  error: { dot: 'bg-destructive', text: 'text-destructive' },
};

// A cell with a stable local id for React keys (nbformat cells have none).
interface EditableCell {
  localId: string;
  cell: NotebookCell;
}

let cellSeq = 0;
function wrap(cell: NotebookCell): EditableCell {
  return { localId: `c${cellSeq++}`, cell };
}

type KernelStatus = 'idle' | 'loading' | 'ready' | 'error';

export function NotebookEditor({
  protocolId,
  projectId,
}: {
  protocolId: string;
  projectId: string;
}) {
  const [title, setTitle] = useState('');
  const [version, setVersion] = useState(0);
  const [notebookMeta, setNotebookMeta] = useState<Notebook | null>(null);
  const [cells, setCells] = useState<EditableCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [kernelStatus, setKernelStatus] = useState<KernelStatus>('idle');
  const [runningId, setRunningId] = useState<string | null>(null);
  const [variables, setVariables] = useState<KernelVariable[]>([]);
  const [kernelMode, setKernelMode] = useState<KernelMode>('pyodide');
  const [jupyterUrl, setJupyterUrl] = useState(
    process.env.NEXT_PUBLIC_JUPYTER_URL ?? '',
  );
  const [jupyterToken, setJupyterToken] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  function kernel() {
    return resolveKernel({ mode: kernelMode, jupyterUrl, jupyterToken });
  }

  const load = useCallback(async () => {
    try {
      const p = await getProtocol(protocolId);
      const nb = JSON.parse(p.notebook) as Notebook;
      setTitle(p.title);
      setVersion(p.version);
      setNotebookMeta(nb);
      setCells((nb.cells ?? []).map(wrap));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [protocolId]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateCell(localId: string, source: string) {
    setCells((prev) =>
      prev.map((c) =>
        c.localId === localId ? { ...c, cell: { ...c.cell, source } } : c,
      ),
    );
  }

  function setCellOutputs(localId: string, outputs: CellOutput[]) {
    setCells((prev) =>
      prev.map((c) =>
        c.localId === localId
          ? { ...c, cell: { ...c.cell, outputs } }
          : c,
      ),
    );
  }

  function addCell(cellType: 'code' | 'markdown') {
    const base: NotebookCell =
      cellType === 'code'
        ? { cell_type: 'code', source: '', metadata: {}, outputs: [], execution_count: null }
        : { cell_type: 'markdown', source: '', metadata: {} };
    setCells((prev) => [...prev, wrap(base)]);
  }

  function deleteCell(localId: string) {
    setCells((prev) => prev.filter((c) => c.localId !== localId));
  }

  async function ensureKernel(): Promise<boolean> {
    setError('');
    try {
      setKernelStatus('loading');
      await kernel().ready();
      setKernelStatus('ready');
      return true;
    } catch (err) {
      setKernelStatus('error');
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }

  async function refreshVariables() {
    try {
      setVariables(await kernel().variables());
    } catch {
      /* ignore inspector errors */
    }
  }

  async function runCell(target: EditableCell): Promise<void> {
    if (target.cell.cell_type !== 'code') return;
    if (!(await ensureKernel())) return;
    setRunningId(target.localId);
    const streamed: CellOutput[] = [];
    setCellOutputs(target.localId, []);
    try {
      const result = await kernel().execute(
        cellText(target.cell),
        (o) => {
          streamed.push(o);
          setCellOutputs(target.localId, [...streamed]);
        },
      );
      setCellOutputs(target.localId, result.outputs);
      setCells((prev) =>
        prev.map((c) =>
          c.localId === target.localId
            ? {
                ...c,
                cell: {
                  ...c.cell,
                  outputs: result.outputs,
                  execution_count: result.executionCount,
                },
              }
            : c,
        ),
      );
      await refreshVariables();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunningId(null);
    }
  }

  async function runAll(): Promise<void> {
    if (!(await ensureKernel())) return;
    for (const c of cells) {
      if (c.cell.cell_type === 'code') {
        await runCell(c);
      }
    }
  }

  function buildNotebook(): Notebook {
    const base = notebookMeta ?? {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {},
      cells: [],
    };
    return { ...base, cells: cells.map((c) => c.cell) };
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setStatus('');
    try {
      const p = await saveProtocol({
        id: protocolId,
        title,
        notebook: JSON.stringify(buildNotebook()),
      });
      setVersion(p.version);
      setStatus(`Saved (v${p.version})`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(buildNotebook(), null, 1)], {
      type: 'application/x-ipynb+json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'protocol'}.ipynb`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const text = await file.text();
      const nb = JSON.parse(text) as Notebook;
      if (nb.nbformat !== 4 || !Array.isArray(nb.cells)) {
        throw new Error('Not a valid nbformat-4 .ipynb file');
      }
      setNotebookMeta(nb);
      setCells(nb.cells.map(wrap));
      setStatus('Imported — remember to Save');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  if (loading) {
    return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4 p-8">
      <Link
        href={`/app/projects/${projectId}`}
        className="text-sm text-muted-foreground underline"
      >
        ← Back to Project
      </Link>

      <div className="flex items-center gap-3">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Protocol title"
          className="font-heading text-lg font-semibold"
        />
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          v{version}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button size="sm" variant="outline" onClick={runAll}>
          Run All
        </Button>
        <Button size="sm" variant="outline" onClick={() => addCell('code')}>
          + Code
        </Button>
        <Button size="sm" variant="outline" onClick={() => addCell('markdown')}>
          + Markdown
        </Button>
        <Button size="sm" variant="outline" onClick={handleExport}>
          Export .ipynb
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInput.current?.click()}
        >
          Import .ipynb
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".ipynb,application/json"
          className="hidden"
          onChange={handleImport}
          data-testid="import-input"
        />
        <span
          className={`ml-auto flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs ${KERNEL_CHIP[kernelStatus].text}`}
          data-testid="kernel-status"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${KERNEL_CHIP[kernelStatus].dot}`}
          />
          Kernel: {kernelStatus}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="text-muted-foreground">Compute:</label>
        <select
          className="rounded-md border bg-background px-2 py-1"
          value={kernelMode}
          onChange={(e) => setKernelMode(e.target.value as KernelMode)}
          aria-label="Kernel compute mode"
          data-testid="kernel-mode"
        >
          <option value="pyodide">Pyodide (in-browser)</option>
          <option value="jupyter">Jupyter (remote server)</option>
        </select>
        {kernelMode === 'jupyter' && (
          <>
            <Input
              className="h-7 w-56 text-xs"
              placeholder="http://127.0.0.1:8888"
              value={jupyterUrl}
              onChange={(e) => setJupyterUrl(e.target.value)}
              aria-label="Jupyter server URL"
            />
            <Input
              className="h-7 w-40 text-xs"
              placeholder="token"
              value={jupyterToken}
              onChange={(e) => setJupyterToken(e.target.value)}
              aria-label="Jupyter token"
            />
          </>
        )}
      </div>

      {status && <p className="text-sm text-muted-foreground">{status}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <ol className="space-y-4" data-testid="cell-list">
        {cells.map((c, i) => {
          const isCode = c.cell.cell_type === 'code';
          const isRunning = runningId === c.localId;
          const count = isCode ? c.cell.execution_count : null;
          return (
            <li
              key={c.localId}
              className="overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-1 focus-within:ring-ring/40"
              data-testid="notebook-cell"
              data-cell-type={c.cell.cell_type}
            >
              <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-1.5 text-xs">
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${
                    isCode
                      ? 'bg-slate-900 text-sky-300'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCode ? `In [${isRunning ? '*' : count ?? ' '}]` : 'markdown'}
                </span>
                {isRunning && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" />
                    running…
                  </span>
                )}
                <div className="ml-auto flex items-center gap-1">
                  {isCode && (
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                      onClick={() => runCell(c)}
                      disabled={isRunning}
                      data-testid="run-cell"
                    >
                      {isRunning ? 'running…' : '▶ run'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => deleteCell(c.localId)}
                  >
                    delete
                  </button>
                </div>
              </div>
              {isCode ? (
                <PythonEditor
                  value={cellText(c.cell)}
                  onChange={(source) => updateCell(c.localId, source)}
                  ariaLabel={`code cell ${i + 1}`}
                />
              ) : (
                <textarea
                  className="min-h-16 w-full resize-y bg-background p-4 text-sm leading-relaxed outline-none"
                  value={cellText(c.cell)}
                  onChange={(e) => updateCell(c.localId, e.target.value)}
                  aria-label={`markdown cell ${i + 1}`}
                />
              )}
              {isCode && (
                <CellOutputs
                  outputs={(c.cell.outputs as CellOutput[]) ?? []}
                  executionCount={count ?? null}
                />
              )}
            </li>
          );
        })}
      </ol>

      <section className="space-y-2" data-testid="variable-inspector">
        <h2 className="font-heading text-sm font-semibold">Variables</h2>
        {variables.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No variables in the kernel yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 font-medium">name</th>
                  <th className="px-3 py-2 font-medium">type</th>
                  <th className="px-3 py-2 font-medium">value</th>
                </tr>
              </thead>
              <tbody>
                {variables.map((v) => (
                  <tr key={v.name} className="border-b last:border-b-0">
                    <td className="px-3 py-1.5 font-mono font-medium">{v.name}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{v.type}</td>
                    <td className="px-3 py-1.5 font-mono">{v.repr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CopilotThread target={{ kind: 'protocol', id: protocolId }} />

      <AnalysisPanel protocolId={protocolId} />
    </section>
  );
}
