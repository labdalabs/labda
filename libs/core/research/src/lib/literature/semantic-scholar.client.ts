import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// A single search hit from the corpus, normalized to what the UI/attach flow
// needs plus the provenance fields (source + externalId).
export interface LiteratureHit {
  externalId: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  url: string | null;
  abstract: string | null;
  // Lawful open-access PDF URL when the paper provides one.
  openAccessPdfUrl: string | null;
}

interface S2Paper {
  paperId: string;
  title: string;
  abstract?: string | null;
  year?: number | null;
  venue?: string | null;
  url?: string | null;
  authors?: { name: string }[] | null;
  openAccessPdf?: { url?: string | null } | null;
}

// Thin client over the Semantic Scholar Graph API. We use it as the corpus —
// we don't rebuild it. No key is required (rate-limited); a key raises limits.
@Injectable()
export class SemanticScholarClient {
  private readonly logger = new Logger(SemanticScholarClient.name);

  constructor(private readonly configService: ConfigService) {}

  async search(query: string, limit = 10): Promise<LiteratureHit[]> {
    const baseUrl = this.configService.getOrThrow<string>(
      'semanticScholar.baseUrl',
    );
    const apiKey = this.configService.get<string>('semanticScholar.apiKey');
    const fields =
      'title,authors,year,venue,url,abstract,externalIds,openAccessPdf';
    const url = `${baseUrl}/paper/search?query=${encodeURIComponent(
      query,
    )}&limit=${limit}&fields=${fields}`;

    // The unauthenticated public API is aggressively rate-limited (429).
    // Retry a few times with backoff before surfacing the failure.
    const maxAttempts = 4;
    let res: Response | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        res = await fetch(url, {
          headers: apiKey ? { 'x-api-key': apiKey } : {},
        });
      } catch (err) {
        this.logger.error('Semantic Scholar request failed', { err, attempt });
        if (attempt === maxAttempts) {
          throw new Error('Literature search is temporarily unavailable');
        }
        await this.delay(attempt);
        continue;
      }

      if (res.status === 429 && attempt < maxAttempts) {
        this.logger.warn(`Semantic Scholar 429; retrying (${attempt})`);
        await this.delay(attempt);
        continue;
      }
      break;
    }

    if (!res || !res.ok) {
      this.logger.error('Semantic Scholar returned an error', {
        status: res?.status,
      });
      throw new Error(`Literature search failed (${res?.status ?? 'network'})`);
    }

    const body = (await res.json()) as { data?: S2Paper[] };
    return (body.data ?? []).map((p) => ({
      externalId: p.paperId,
      title: p.title,
      authors: (p.authors ?? []).map((a) => a.name),
      year: p.year ?? null,
      venue: p.venue ?? null,
      url: p.url ?? null,
      abstract: p.abstract ?? null,
      openAccessPdfUrl: p.openAccessPdf?.url || null,
    }));
  }

  private delay(attempt: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, attempt * 750));
  }
}
