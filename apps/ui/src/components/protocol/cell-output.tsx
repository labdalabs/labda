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

// Render a code cell's nbformat outputs (text streams, results, errors, images).
export function CellOutputs({ outputs }: { outputs: CellOutput[] }) {
  if (!outputs || outputs.length === 0) return null;
  return (
    <div className="space-y-1 border-t bg-muted/20 p-2" data-testid="cell-outputs">
      {outputs.map((o, i) => {
        if (o.output_type === 'stream') {
          return (
            <pre
              key={i}
              className={`whitespace-pre-wrap text-xs ${
                o.name === 'stderr' ? 'text-destructive' : ''
              }`}
            >
              {o.text}
            </pre>
          );
        }
        if (o.output_type === 'error') {
          return (
            <pre
              key={i}
              className="whitespace-pre-wrap text-xs text-destructive"
            >
              {o.ename}: {o.evalue}
            </pre>
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
              className="max-w-full"
            />
          );
        }
        return (
          <pre key={i} className="whitespace-pre-wrap text-xs">
            {textOf(o.data)}
          </pre>
        );
      })}
    </div>
  );
}
