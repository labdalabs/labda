import { createClient } from '@/lib/supabase/browser';
import { ApiError } from './client';

function graphqlUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_URL;
  if (!value) throw new Error('NEXT_PUBLIC_API_URL is not set');
  // NEXT_PUBLIC_API_URL already includes the /api prefix; the GraphQL path is
  // mounted at /api/graphql on the Nest server. Normalize slashes so a trailing
  // or doubled `/` in the env value can't produce `//api/graphql`.
  const base = value.replace(/\/+$/, '').replace(/([^:])\/\/+/g, '$1/');
  return `${base}/graphql`;
}

// Execute a GraphQL operation against the Nest API with the current Supabase
// access token attached as Bearer. Throws ApiError on transport or GraphQL
// errors; returns the typed `data` payload on success.
//
//   const { myProjects } = await graphql<{ myProjects: Project[] }>(MY_PROJECTS);
export async function graphql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  const res = await fetch(graphqlUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const errorBody: unknown = await res
      .json()
      .catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, errorBody, `HTTP ${res.status}`);
  }

  const json = (await res.json()) as {
    data?: T;
    errors?: { message: string }[];
  };
  if (json.errors?.length) {
    throw new ApiError(200, json.errors, json.errors[0].message);
  }
  return json.data as T;
}
