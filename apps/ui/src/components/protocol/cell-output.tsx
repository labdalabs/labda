'use client';

import type { CellOutput } from '@/lib/kernel/types';

function textOf(data: Record<string, unknown>): string {
  const v = data['text/plain'];
  if (Array.isArray(v)) return v.join('');
  return typeof v === 'string' ? v : '';
}

function pngOf(data: Record<string, unknown>): string | null {
  const v = data['image/png'];
  return typeof v === 'string' ? v : null;
}

// Render a code cell's nbformat outputs (text streams, results, errors,
// images) in the Jupyter idiom: an `Out [n]` gutter chip, quiet mono text,
// framed plots, and a clear error banner.
export function CellOutputs({
  outputs,
  executionCount = null,
}: {
  outputs: CellOutput[];
  executionCount?: number | null;
}) {
  if (!outputs || outputs.length === 0) return null;
  return (
    <div
      className="space-y-2 border-t bg-muted/20 px-3 py-2.5"
      data-testid="cell-outputs"
    >
      <span className="inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
        Out [{executionCount ?? ' '}]
      </span>
      {outputs.map((o, i) => {
        if (o.output_type === 'stream') {
          return (
            <pre
              key={i}
              className={`whitespace-pre-wrap font-mono text-xs leading-5 ${
                o.name === 'stderr' ? 'text-destructive' : 'text-foreground'
              }`}
            >
              {o.text}
            </pre>
          );
        }
        if (o.output_type === 'error') {
          return (
            <div
              key={i}
              className="rounded-md border-l-2 border-destructive bg-destructive/5 px-3 py-2"
            >
              <span className="font-mono text-xs font-semibold text-destructive">
                {o.ename}
              </span>
              <pre className="mt-0.5 whitespace-pre-wrap font-mono text-xs text-destructive/90">
                {o.evalue}
              </pre>
            </div>
          );
        }
        // execute_result | display_data
        const png = pngOf(o.data);
        if (png) {
          return (
            <img
              key={i}
              src={`data:image/png;base64,${png}`}
              alt="cell output"
              className="max-w-full rounded-lg border bg-white p-1 shadow-sm"
            />
          );
        }
        return (
          <pre
            key={i}
            className="whitespace-pre-wrap font-mono text-xs leading-5 text-foreground"
          >
            {textOf(o.data)}
          </pre>
        );
      })}
    </div>
  );
}
