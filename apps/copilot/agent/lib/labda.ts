// Thin GraphQL client for the labda API. The copilot's tools call the grounded
// challenge engine over this, so their results are evidence-grounded.
//
// Config via env:
//   LABDA_API_URL   base GraphQL URL (default http://localhost:3001/api/graphql)
//   LABDA_TOKEN     fallback Supabase access token (dev / schedules only)
//
// The agent acts as the *signed-in researcher*: the eve channel authenticates
// the inbound request with the user's Supabase token and stashes it on the
// session auth (`attributes.token`). Tools read it via `callerToken(ctx)` and
// pass it here, so every API call runs with the caller's own permissions. The
// env `LABDA_TOKEN` is only a fallback for unattended paths (cron schedules).

const API_URL =
  process.env.LABDA_API_URL ?? 'http://localhost:3001/api/graphql';

// Minimal shape of the eve tool `execute(input, ctx)` context we read from.
interface CallerContext {
  readonly session?: {
    readonly auth?: {
      readonly current?: {
        readonly attributes?: Readonly<Record<string, string | readonly string[]>>;
      } | null;
    };
  };
}

// Resolve the acting researcher's access token: the per-request token the eve
// channel put on the session auth, else the env fallback.
export function callerToken(ctx?: CallerContext): string | undefined {
  const attr = ctx?.session?.auth?.current?.attributes?.['token'];
  return (typeof attr === 'string' ? attr : undefined) ?? process.env.LABDA_TOKEN;
}

export async function labdaGraphql<T = unknown>(
  query: string,
  variables: Record<string, unknown>,
  token = process.env.LABDA_TOKEN,
): Promise<T> {
  if (!token) {
    throw new Error(
      'LABDA_TOKEN is not set — the copilot needs the researcher\'s access token to call the API.',
    );
  }
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`labda API HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: T;
    errors?: { message: string }[];
  };
  if (json.errors?.length) {
    throw new Error(json.errors[0].message);
  }
  return json.data as T;
}

export const FINDING_FIELDS = `
  kind
  summary
  referenceId
  sourceTitle
  sourceUrl
  quote
`;

export interface ChallengeFinding {
  kind: string;
  summary: string;
  referenceId: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  quote: string | null;
}
