// Minimal EVE agent HTTP-API stub for deterministic e2e. The real EVE agent
// (apps/copilot) needs a live model credential to run; this stub implements
// just enough of the session API for the frontend integration test:
//   POST /eve/v1/session            -> { continuationToken }, x-eve-session-id
//   GET  /eve/v1/session/:id/stream -> NDJSON assistant deltas
import { createServer } from 'node:http';

const PORT = Number(process.env.EVE_STUB_PORT || 4600);

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/eve/v1/session') {
    // Drain the request body.
    for await (const _ of req) void _;
    res.writeHead(200, {
      'content-type': 'application/json',
      'x-eve-session-id': 'stub-session',
    });
    res.end(JSON.stringify({ continuationToken: 'stub-token' }));
    return;
  }

  if (
    req.method === 'GET' &&
    /^\/eve\/v1\/session\/[^/]+\/stream$/.test(url.pathname)
  ) {
    res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8' });
    const deltas = [
      { type: 'session.started' },
      { type: 'tool.call', name: 'challenge_hypothesis' },
      { role: 'assistant', delta: 'I challenged the hypothesis: ' },
      { role: 'assistant', delta: 'one Reference contradicts it.' },
      { type: 'session.completed' },
    ];
    for (const d of deltas) res.write(JSON.stringify(d) + '\n');
    res.end();
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`eve-stub listening on http://127.0.0.1:${PORT}`);
});
