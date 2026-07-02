// Thin GraphQL client for the labda API. The copilot's tools call the grounded
// challenge engine over this, so their results are evidence-grounded.
//
// Config via env:
//   LABDA_API_URL   base GraphQL URL (default http://localhost:3001/api/graphql)
//   LABDA_TOKEN     a Supabase access token for the acting researcher
//
// In a full frontend integration the per-user token is threaded from the
// session; for local/dev the env token is used.

const API_URL =
  process.env.LABDA_API_URL ?? 'http://localhost:3001/api/graphql';

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
