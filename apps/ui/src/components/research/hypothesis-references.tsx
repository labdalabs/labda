'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@labda/ui/components/ui/button';
import { Input } from '@labda/ui/components/ui/input';
import { ApiError } from '@/lib/api/client';
import {
  attachReference,
  listReferences,
  searchLiterature,
} from '@/lib/research/queries';
import type { LiteratureResult, Reference } from '@/lib/research/types';
import { CopilotThread } from '@/components/copilot/copilot-thread';

// Literature search welded to a single Hypothesis: search the corpus, attach a
// result as a Reference (with provenance + source link), and see attached
// References listed under the Hypothesis.
export function HypothesisReferences({
  hypothesisId,
}: {
  hypothesisId: string;
}) {
  const [references, setReferences] = useState<Reference[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LiteratureResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setReferences(await listReferences(hypothesisId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }, [hypothesisId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError('');
    try {
      setResults(await searchLiterature(query.trim()));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  }

  async function handleAttach(result: LiteratureResult) {
    setAttachingId(result.externalId);
    setError('');
    try {
      await attachReference({ hypothesisId, ...result });
      setResults((prev) =>
        prev.filter((r) => r.externalId !== result.externalId),
      );
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setAttachingId(null);
    }
  }

  return (
    <div className="mt-3 space-y-3 border-t pt-3" data-testid="hypothesis-references">
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          placeholder="Search literature…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Literature search query"
        />
        <Button type="submit" size="sm" disabled={searching || !query.trim()}>
          {searching ? 'Searching…' : 'Search'}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {results.length > 0 && (
        <ul className="space-y-2" data-testid="literature-results">
          {results.map((r) => (
            <li
              key={r.externalId}
              className="flex items-start justify-between gap-2 rounded-md border bg-muted/30 p-2 text-sm"
            >
              <div>
                <p className="font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">
                  {[r.authors.slice(0, 3).join(', '), r.year, r.venue]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAttach(r)}
                disabled={attachingId === r.externalId}
              >
                {attachingId === r.externalId ? 'Attaching…' : 'Attach'}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          References
        </p>
        {references.length === 0 ? (
          <p className="text-sm text-muted-foreground">No References yet.</p>
        ) : (
          <ul className="space-y-1" data-testid="reference-list">
            {references.map((ref) => (
              <li key={ref.id} className="rounded-md border bg-card p-2 text-sm">
                <p className="font-medium">{ref.title}</p>
                <p className="text-xs text-muted-foreground">
                  {[ref.authors.slice(0, 3).join(', '), ref.year, ref.venue]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {ref.url && (
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline"
                  >
                    Source
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <CopilotThread target={{ kind: 'hypothesis', id: hypothesisId }} />
    </div>
  );
}
