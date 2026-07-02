import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Same-origin proxy to the EVE agent's stable HTTP API (apps/copilot). The
// verbatim `useEveAgentRuntime()` client calls same-origin `/eve/v1/*`; this
// handler reads the signed-in researcher's Supabase access token server-side
// and forwards it as a Bearer, so the agent acts as that researcher (its
// channel verifies the token — see apps/copilot/agent/channels/eve.ts).
//
// EVE_URL points at the agent deployment (defaults to the local `eve dev`
// server). Streaming (NDJSON) responses are piped straight through.
export const dynamic = 'force-dynamic';

function eveBase(): string {
  return process.env.EVE_URL ?? 'http://127.0.0.1:3000';
}

async function forward(req: NextRequest, path: string[]): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  const target = `${eveBase()}/eve/v1/${path.join('/')}${req.nextUrl.search}`;
  const headers: Record<string, string> = {
    'content-type': req.headers.get('content-type') ?? 'application/json',
  };
  if (token) headers.authorization = `Bearer ${token}`;

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    // Only forward a body for methods that have one.
    body:
      req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text(),
  });

  // Pipe the (possibly streaming NDJSON) response through unchanged.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type':
        upstream.headers.get('content-type') ?? 'application/json',
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
