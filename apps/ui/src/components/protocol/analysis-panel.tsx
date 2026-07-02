'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@labda/ui/components/ui/button';
import { Input } from '@labda/ui/components/ui/input';
import { ApiError } from '@/lib/api/client';
import {
  exportAnalysis,
  listAnalyses,
  runAnalysis,
} from '@/lib/analysis/queries';
import type { Analysis, AnalysisResults } from '@/lib/analysis/types';

const SAMPLE = JSON.stringify(
  { columns: ['dose', 'response'], rows: [[1, 10], [2, 22], [3, 31], [4, 44]] },
  null,
  2,
);

function BarChart({ results }: { results: AnalysisResults }) {
  const max = Math.max(1, ...results.chart.values.map((v) => Math.abs(v)));
  return (
    <div className="space-y-1.5" data-testid="analysis-chart">
      <p className="font-heading text-xs font-semibold">{results.chart.title}</p>
      {results.chart.categories.map((cat, i) => (
        <div key={cat} className="flex items-center gap-2 text-xs">
          <span className="w-20 shrink-0 truncate text-muted-foreground">
            {cat}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted/50">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-sky to-brand-sky-light transition-[width] duration-500"
              style={{ width: `${(Math.abs(results.chart.values[i]) / max) * 100}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-right font-mono tabular-nums">
            {results.chart.values[i]}
          </span>
        </div>
      ))}
    </div>
  );
}

// Analysis surface alongside the notebook: apply calculations to a dataset,
// see stats + a chart, and export to `.xlsx`.
export function AnalysisPanel({ protocolId }: { protocolId: string }) {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [name, setName] = useState('Analysis 1');
  const [dataText, setDataText] = useState(SAMPLE);
  const [running, setRunning] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [download, setDownload] = useState<{ id: string; url: string } | null>(
    null,
  );
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setAnalyses(await listAnalyses(protocolId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }, [protocolId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleRun(e: React.FormEvent) {
    e.preventDefault();
    setRunning(true);
    setError('');
    try {
      await runAnalysis({ protocolId, name: name.trim() || 'Analysis', data: dataText });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  async function handleExport(id: string) {
    setExportingId(id);
    setError('');
    setDownload(null);
    try {
      const { url } = await exportAnalysis(id);
      setDownload({ id, url });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setExportingId(null);
    }
  }

  return (
    <section className="space-y-3" data-testid="analysis-panel">
      <h2 className="font-heading text-lg font-semibold">Analysis</h2>

      <form onSubmit={handleRun} className="space-y-2 rounded-xl border bg-card p-4 shadow-sm">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Analysis name"
          placeholder="Analysis name"
        />
        <textarea
          className="min-h-28 w-full rounded-md border bg-background p-2 font-mono text-xs"
          value={dataText}
          onChange={(e) => setDataText(e.target.value)}
          aria-label="Analysis dataset"
        />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={running}>
            {running ? 'Running…' : 'Run Analysis'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setDataText(SAMPLE)}
          >
            Use sample data
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>

      {analyses.length === 0 ? (
        <p className="text-sm text-muted-foreground">No analyses yet.</p>
      ) : (
        <ul className="space-y-3" data-testid="analysis-list">
          {analyses.map((a) => {
            const results = JSON.parse(a.results) as AnalysisResults;
            return (
              <li key={a.id} className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-medium">{a.name}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExport(a.id)}
                    disabled={exportingId === a.id}
                  >
                    {exportingId === a.id ? 'Exporting…' : 'Export to Excel'}
                  </Button>
                </div>

                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/30 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-3 py-2 font-medium">column</th>
                        <th className="px-3 py-2 font-medium">mean</th>
                        <th className="px-3 py-2 font-medium">median</th>
                        <th className="px-3 py-2 font-medium">min</th>
                        <th className="px-3 py-2 font-medium">max</th>
                        <th className="px-3 py-2 font-medium">std</th>
                      </tr>
                    </thead>
                    <tbody data-testid="analysis-stats">
                      {results.stats.map((s) => (
                        <tr key={s.column} className="border-b tabular-nums last:border-b-0">
                          <td className="px-3 py-1.5 font-mono font-medium">{s.column}</td>
                          <td className="px-3 py-1.5">{s.mean}</td>
                          <td className="px-3 py-1.5">{s.median}</td>
                          <td className="px-3 py-1.5">{s.min}</td>
                          <td className="px-3 py-1.5">{s.max}</td>
                          <td className="px-3 py-1.5">{s.std}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <BarChart results={results} />

                {download?.id === a.id && (
                  <a
                    href={download.url}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="inline-block text-sm underline"
                    data-testid="download-xlsx"
                  >
                    Download .xlsx
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
