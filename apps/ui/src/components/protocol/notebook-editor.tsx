'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@labda/ui/components/ui/button';
import { Input } from '@labda/ui/components/ui/input';
import { ApiError } from '@/lib/api/client';
import { getProtocol, saveProtocol } from '@/lib/protocol/queries';
import { cellText, type Notebook, type NotebookCell } from '@/lib/protocol/types';
import { getKernel } from '@/lib/kernel/pyodide-kernel';
import type { CellOutput, KernelVariable } from '@/lib/kernel/types';
import { CellOutputs } from './cell-output';
import { AnalysisPanel } from './analysis-panel';
import { CopilotThread } from '@/components/copilot/copilot-thread';

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
  const fileInput = useRef<HTMLInputElement>(null);

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
      await getKernel().ready();
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
      setVariables(await getKernel().variables());
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
      const result = await getKernel().execute(
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
          className="text-lg font-semibold"
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
        <span className="ml-auto text-xs text-muted-foreground" data-testid="kernel-status">
          Kernel: {kernelStatus}
        </span>
      </div>

      {status && <p className="text-sm text-muted-foreground">{status}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <ol className="space-y-3" data-testid="cell-list">
        {cells.map((c, i) => (
          <li
            key={c.localId}
            className="rounded-md border bg-card"
            data-testid="notebook-cell"
            data-cell-type={c.cell.cell_type}
          >
            <div className="flex items-center justify-between border-b px-3 py-1 text-xs text-muted-foreground">
              <span>
                [{i + 1}] {c.cell.cell_type}
              </span>
              <div className="flex items-center gap-2">
                {c.cell.cell_type === 'code' && (
                  <button
                    type="button"
                    className="underline"
                    onClick={() => runCell(c)}
                    disabled={runningId === c.localId}
                    data-testid="run-cell"
                  >
                    {runningId === c.localId ? 'running…' : 'run'}
                  </button>
                )}
                <button
                  type="button"
                  className="underline"
                  onClick={() => deleteCell(c.localId)}
                >
                  delete
                </button>
              </div>
            </div>
            <textarea
              className={`min-h-16 w-full resize-y bg-background p-3 text-sm ${
                c.cell.cell_type === 'code' ? 'font-mono' : ''
              }`}
              value={cellText(c.cell)}
              onChange={(e) => updateCell(c.localId, e.target.value)}
              aria-label={`${c.cell.cell_type} cell ${i + 1}`}
            />
            {c.cell.cell_type === 'code' && (
              <CellOutputs outputs={(c.cell.outputs as CellOutput[]) ?? []} />
            )}
          </li>
        ))}
      </ol>

      <section className="space-y-1" data-testid="variable-inspector">
        <h2 className="text-sm font-semibold">Variables</h2>
        {variables.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No variables in the kernel yet.
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pr-4">name</th>
                <th className="pr-4">type</th>
                <th>value</th>
              </tr>
            </thead>
            <tbody>
              {variables.map((v) => (
                <tr key={v.name}>
                  <td className="pr-4 font-mono">{v.name}</td>
                  <td className="pr-4 text-muted-foreground">{v.type}</td>
                  <td className="font-mono">{v.repr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <CopilotThread target={{ kind: 'protocol', id: protocolId }} />

      <AnalysisPanel protocolId={protocolId} />
    </section>
  );
}
