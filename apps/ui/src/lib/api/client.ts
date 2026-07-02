import { createClient } from '@/lib/supabase/browser';

function apiUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_URL;
  if (!value) throw new Error('NEXT_PUBLIC_API_URL is not set');
  // Normalize slashes so a trailing/doubled `/` in the env can't produce `//`.
  return value.replace(/\/+$/, '').replace(/([^:])\/\/+/g, '$1/');
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Fetch the Nest API with the current Supabase access_token as Bearer.
// Throws ApiError on non-2xx responses; returns the parsed JSON body on success.
//
//   const me = await apiFetch<{ id: string; email: string }>('/me');
//   const created = await apiFetch('/widgets', { method: 'POST', body: { name: 'X' } });
export async function apiFetch<T = unknown>(
  path: string,
  init: Omit<RequestInit, 'body'> & { body?: unknown } = {},
): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  const { body, headers, ...rest } = init;
  const res = await fetch(`${apiUrl()}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody: unknown = await res
      .json()
      .catch(() => ({ message: res.statusText }));
    const message =
      (errorBody as { message?: string })?.message ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, errorBody, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
