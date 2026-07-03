// Minimal EVE agent HTTP-API stub for deterministic e2e. The real EVE agent
// (apps/copilot) needs a live model credential to run; this stub implements
// just enough of the session API — with EVE's real event shape — for the
// frontend integration test:
//   POST /eve/v1/session            -> { sessionId, continuationToken, ok }
//   POST /eve/v1/session/:id         -> follow-up (200)
//   GET  /eve/v1/session/:id/stream  -> NDJSON events (message.appended/completed)
import { createServer } from 'node:http';

const PORT = Number(process.env.EVE_STUB_PORT || 4600);

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Start a session, or send a follow-up on an existing one.
  if (
    req.method === 'POST' &&
    (url.pathname === '/eve/v1/session' ||
      /^\/eve\/v1\/session\/[^/]+$/.test(url.pathname))
  ) {
    for await (const _ of req) void _;
    res.writeHead(200, {
      'content-type': 'application/json',
      'x-eve-session-id': 'stub-session',
    });
    res.end(
      JSON.stringify({ ok: true, sessionId: 'stub-session', continuationToken: 'eve:stub' }),
    );
    return;
  }

  if (
    req.method === 'GET' &&
    /^\/eve\/v1\/session\/[^/]+\/stream$/.test(url.pathname)
  ) {
    res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8' });
    // Mirror the real agent's event sequence: the assistant text part is keyed
    // by (turnId, stepIndex), created by step.started and filled by
    // message.appended/completed — the client reducer needs stepIndex.
    const at = '2026-07-02T13:47:20.000Z';
    const full = 'I challenged the hypothesis: one Reference contradicts it.';
    const T = 'turn_0';
    const events = [
      { type: 'session.started', data: { agentId: 'copilot', agentName: 'copilot' }, meta: { at } },
      { type: 'turn.started', data: { sequence: 0, turnId: T }, meta: { at } },
      { type: 'message.received', data: { message: 'Challenge my hypothesis', sequence: 0, turnId: T }, meta: { at } },
      { type: 'step.started', data: { sequence: 0, stepIndex: 0, turnId: T }, meta: { at } },
      { type: 'message.appended', data: { messageDelta: 'I challenged ', messageSoFar: 'I challenged ', sequence: 0, stepIndex: 0, turnId: T }, meta: { at } },
      { type: 'message.appended', data: { messageDelta: full.slice(12), messageSoFar: full, sequence: 0, stepIndex: 0, turnId: T }, meta: { at } },
      { type: 'message.completed', data: { finishReason: 'stop', message: full, sequence: 0, stepIndex: 0, turnId: T }, meta: { at } },
      { type: 'step.completed', data: { finishReason: 'stop', sequence: 0, stepIndex: 0, turnId: T }, meta: { at } },
      // The agent's ask_question HITL: a tool call + an input request the UI
      // should render as a question with clickable options.
      { type: 'step.started', data: { sequence: 1, stepIndex: 1, turnId: T }, meta: { at } },
      { type: 'actions.requested', data: { sequence: 1, stepIndex: 1, turnId: T, actions: [{ callId: 'q1', kind: 'tool-call', toolName: 'ask_question', input: { prompt: 'Which aspect are you focusing on?', options: [{ id: 'structure', label: 'Structure' }, { id: 'function', label: 'Function' }], allowFreeform: true } }] }, meta: { at } },
      { type: 'input.requested', data: { sequence: 1, stepIndex: 1, turnId: T, requests: [{ requestId: 'q1', display: 'select', prompt: 'Which aspect are you focusing on?', allowFreeform: true, options: [{ id: 'structure', label: 'Structure', description: 'fold / misfolding' }, { id: 'function', label: 'Function', description: 'activity / binding' }] }] }, meta: { at } },
      { type: 'session.waiting', data: { wait: 'input' }, meta: { at } },
    ];
    for (const e of events) res.write(JSON.stringify(e) + '\n');
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
