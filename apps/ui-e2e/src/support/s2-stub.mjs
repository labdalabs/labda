// Minimal Semantic Scholar Graph API stub for deterministic e2e runs.
// The real public API is rate-limited (429), which makes e2e flaky. The API
// under test is pointed at this stub via SEMANTIC_SCHOLAR_BASE_URL.
//
// Implements just GET /paper/search returning an S2-shaped payload.
import { createServer } from 'node:http';

const PORT = Number(process.env.S2_STUB_PORT || 4599);

const PAPERS = [
  {
    paperId: 'stub-paper-1',
    title: 'CRISPR-Cas9 increases crop yield in field trials',
    abstract: 'A study showing gene editing improves yield.',
    year: 2021,
    venue: 'Nature Plants',
    url: 'https://example.org/paper/stub-paper-1',
    externalIds: { DOI: '10.0000/stub1' },
    authors: [{ name: 'Ada Lovelace' }, { name: 'Alan Turing' }],
  },
  {
    paperId: 'stub-paper-2',
    title: 'Off-target effects of genome editing in plants',
    abstract: 'Analysis of unintended edits.',
    year: 2020,
    venue: 'Cell',
    url: 'https://example.org/paper/stub-paper-2',
    externalIds: { DOI: '10.0000/stub2' },
    authors: [{ name: 'Grace Hopper' }],
  },
];

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === '/' || url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (url.pathname.endsWith('/paper/search')) {
    const limit = Number(url.searchParams.get('limit') || 10);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        total: PAPERS.length,
        offset: 0,
        data: PAPERS.slice(0, limit),
      }),
    );
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`s2-stub listening on http://127.0.0.1:${PORT}`);
});
