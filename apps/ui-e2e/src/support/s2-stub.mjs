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
    openAccessPdf: { url: `http://127.0.0.1:${PORT}/pdf/stub-paper-1` },
  },
  {
    paperId: 'stub-paper-2',
    title: 'Field trial finds no yield benefit from CRISPR editing',
    abstract:
      'In multi-site field trials, CRISPR editing did not increase crop yield. No significant effect on yield was observed relative to controls.',
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
  if (url.pathname.startsWith('/pdf/')) {
    // A minimal but valid PDF, for the open-access download flow.
    const pdf =
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n' +
      'trailer<</Root 1 0 R>>\n%%EOF\n';
    res.writeHead(200, { 'Content-Type': 'application/pdf' });
    res.end(pdf);
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
