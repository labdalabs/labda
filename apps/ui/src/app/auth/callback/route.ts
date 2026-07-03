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

  // Desktop (Electron) sign-in: this browser doesn't hold the PKCE verifier, so
  // hand the code to the app via its custom protocol (labda://auth), where the
  // verifier lives, and let it finish the exchange. An HTML page launches the
  // app with a manual fallback link.
  if (url.searchParams.get('desktop') && code) {
    const deep = `labda://auth?code=${encodeURIComponent(
      code,
    )}&next=${encodeURIComponent(next)}`;
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Opening Labda…</title>
<meta http-equiv="refresh" content="0;url=${deep}">
<style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0f1c;color:#e8f2fb}
.c{text-align:center;line-height:1.6}a{color:#8fc0de}</style></head>
<body><div class="c"><p>Opening the Labda app…</p>
<p><a href="${deep}">Click here if it doesn&rsquo;t open automatically.</a></p>
<p style="opacity:.5;font-size:.9em">You can close this tab.</p></div>
<script>location.href=${JSON.stringify(deep)}</script></body></html>`;
    return new NextResponse(html, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

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
