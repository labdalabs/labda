import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

interface CookieToSet {
  name: string;
  value: string;
  options?: { [key: string]: unknown };
}

// Server-side Supabase client for Server Components, Route Handlers, and
// Server Actions. Reads/writes session cookies via Next's cookies() API.
//
//   const supabase = await createClient();
//   const { data: { user } } = await supabase.auth.getUser();
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` was called from a Server Component. Safe to ignore — the
            // middleware will refresh the session on the next request.
          }
        },
      },
    },
  );
}
