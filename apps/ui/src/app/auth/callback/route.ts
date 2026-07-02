import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Handles the email magic-link / PKCE return. Supabase redirects here with a
// `?code=` (or `?token_hash=&type=`) which we exchange for a session cookie,
// then send the user into the app. The 6-digit OTP flow doesn't need this route,
// but clicking the link in the email does.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const next = url.searchParams.get('next') ?? '/app';

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as 'magiclink' | 'email' | 'recovery' | 'invite' | 'signup',
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }

  // Fall back to the sign-in page on any failure.
  return NextResponse.redirect(
    new URL('/auth/sign-in?error=callback', url.origin),
  );
}
