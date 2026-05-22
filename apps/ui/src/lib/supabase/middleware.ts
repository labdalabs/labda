import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

interface CookieToSet {
  name: string;
  value: string;
  options?: { [key: string]: unknown };
}

// Wired by /middleware.ts at the app root. On every request, refreshes the
// Supabase session by re-reading the auth cookie, validating it against
// Supabase, and writing the updated cookie back on the response. Without this,
// expired tokens linger and server-side `getUser()` calls start returning null.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // `getUser()` returns the authenticated user and refreshes the token if
  // needed. Side-effects (cookie writes) happen via setAll above.
  await supabase.auth.getUser();

  return supabaseResponse;
}
