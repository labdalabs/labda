import { NextRequest } from 'next/server';

// Same-origin proxy to the EVE agent's stable HTTP API (apps/copilot). The
// browser talks to /api/eve/*; this forwards to EVE_URL server-side so there's
// no CORS and the researcher's token can be attached out of band. Streaming
// (NDJSON) responses are piped straight through.
//
// EVE_URL defaults to the local `eve dev` server.
function eveBase(): string {
  return process.env.EVE_URL ?? 'http://127.0.0.1:3000';
}

async function forward(req: NextRequest, path: string[]): Promise<Response> {
  const target = `${eveBase()}/eve/v1/${path.join('/')}${req.nextUrl.search}`;
  const init: RequestInit = {
    method: req.method,
    headers: { 'content-type': req.headers.get('content-type') ?? 'application/json' },
    // Only forward a body for methods that have one.
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text(),
  };
  const upstream = await fetch(target, init);
  // Pipe the (possibly streaming NDJSON) response through unchanged.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type':
        upstream.headers.get('content-type') ?? 'application/json',
      'x-eve-session-id': upstream.headers.get('x-eve-session-id') ?? '',
    },
  });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return forward(req, path);
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return forward(req, path);
}
