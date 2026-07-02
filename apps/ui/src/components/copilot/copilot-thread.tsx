'use client';

import { useState } from 'react';
import { Button } from '@labda/ui/components/ui/button';
import { ApiError } from '@/lib/api/client';
import {
  challengeHypothesis,
  challengeProtocol,
  type ChallengeFinding,
} from '@/lib/copilot/queries';

type Target =
  | { kind: 'hypothesis'; id: string }
  | { kind: 'protocol'; id: string };

const KIND_LABEL: Record<ChallengeFinding['kind'], string> = {
  CONTRADICTS: 'Contradicts',
  SUPPORTS: 'Supports',
  LOGIC_GAP: 'Logic gap',
  MISSING_STEP: 'Missing step',
};

const KIND_CLASS: Record<ChallengeFinding['kind'], string> = {
  CONTRADICTS: 'border-destructive/50 bg-destructive/5',
  SUPPORTS: 'border-success/40 bg-success/5',
  LOGIC_GAP: 'border-warning/40 bg-warning/5',
  MISSING_STEP: 'border-warning/40 bg-warning/5',
};

// The antagonistic copilot thread: challenges a Hypothesis or Protocol and
// renders grounded push-backs — every finding links a Reference (with a quote)
// or names a concrete gap. No vibes-based output.
export function CopilotThread({ target }: { target: Target }) {
  const [findings, setFindings] = useState<ChallengeFinding[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleChallenge() {
    setLoading(true);
    setError('');
    try {
      const result =
        target.kind === 'hypothesis'
          ? await challengeHypothesis(target.id)
          : await challengeProtocol(target.id);
      setFindings(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const label =
    target.kind === 'hypothesis' ? 'Challenge this Hypothesis' : 'Challenge this Protocol';

  return (
    <div className="mt-3 space-y-2 rounded-md border border-dashed p-3" data-testid="copilot-thread">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          Copilot
        </p>
        <Button size="sm" variant="outline" onClick={handleChallenge} disabled={loading}>
          {loading ? 'Thinking…' : label}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {findings !== null &&
        (findings.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="copilot-empty">
            No grounded push-backs found.
          </p>
        ) : (
          <ul className="space-y-2" data-testid="copilot-findings">
            {findings.map((f, i) => (
              <li
                key={i}
                className={`rounded-md border p-2 text-sm ${KIND_CLASS[f.kind]}`}
                data-finding-kind={f.kind}
              >
                <p>
                  <span className="font-semibold">{KIND_LABEL[f.kind]}:</span>{' '}
                  {f.summary}
                </p>
                {f.quote && (
                  <blockquote className="mt-1 border-l-2 pl-2 text-xs italic text-muted-foreground">
                    “{f.quote}”
                  </blockquote>
                )}
                {f.sourceUrl && (
                  <a
                    href={f.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs underline"
                    data-testid="copilot-source"
                  >
                    {f.sourceTitle ?? 'Source'}
                  </a>
                )}
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
