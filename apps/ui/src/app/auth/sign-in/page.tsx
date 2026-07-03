'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@labda/ui/components/ui/button';
import { Input } from '@labda/ui/components/ui/input';
import { createClient } from '@/lib/supabase/browser';

// Brand-sky primary button — matches the landing gradient, not the taupe token.
const BRAND_BUTTON =
  'w-full bg-brand-sky text-white shadow-sm transition-colors hover:bg-brand-sky/90';

// Two-step email OTP flow:
//   1. POST email -> Supabase sends a 6-digit code to the inbox.
//   2. User pastes the code -> verifyOtp exchanges it for a session.
//
// Locally, the email lands in Inbucket at http://localhost:54324.
export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isLocal, setIsLocal] = useState(false);

  // Inbucket only exists for the local Supabase stack; don't mention it in prod.
  useEffect(() => {
    setIsLocal(window.location.hostname === 'localhost');
  }, []);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        // Make the email's magic link return to THIS origin (localhost in dev,
        // the deployed domain in prod) rather than a fixed Site URL. The URL
        // must be allow-listed in Supabase → Auth → URL Configuration. In the
        // desktop (Electron) app, tag it `?desktop=1` so the callback bounces
        // the PKCE code back into the app via the labda:// deep link.
        emailRedirectTo:
          typeof window !== 'undefined'
            ? `${window.location.origin}/auth/callback${
                /electron/i.test(navigator.userAgent) ? '?desktop=1' : ''
              }`
            : undefined,
      },
    });
    if (err) setError(err.message);
    else setSent(true);
    setLoading(false);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });
    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      router.push('/app');
      router.refresh();
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-brand-sky via-brand-sky-light to-brand-cream p-4 font-heading">
      {/* Landing-page grain, so sign-in reads as the same material. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6">
        <Image
          src="/labda_logo_xs.png"
          alt="Labda"
          width={640}
          height={640}
          priority
          className="h-14 w-auto [filter:brightness(0)_invert(1)] drop-shadow-sm"
        />

        <div className="w-full rounded-2xl border border-white/50 bg-card/95 p-8 shadow-xl shadow-brand-sky/10 backdrop-blur flex flex-col gap-6">
          <div className="flex flex-col gap-1 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            {!sent && (
              <p className="text-sm text-muted-foreground">
                Enter your email to receive a one-time code.
              </p>
            )}
          </div>

          {!sent ? (
            <form onSubmit={handleSendCode} className="flex flex-col gap-3">
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
              <Button
                type="submit"
                className={BRAND_BUTTON}
                disabled={loading || !email.trim()}
              >
                {loading ? 'Sending…' : 'Send code'}
              </Button>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {isLocal && (
                <p className="text-xs text-muted-foreground text-center">
                  Locally, emails appear in Inbucket at{' '}
                  <a
                    href="http://localhost:54324"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    localhost:54324
                  </a>
                  .
                </p>
              )}
            </form>
          ) : (
            <form onSubmit={handleVerify} className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground text-center">
                Enter the 6-digit code sent to{' '}
                <strong className="text-foreground">{email}</strong>.
              </p>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="123456"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
                required
                className="text-center text-lg tracking-[0.4em] font-mono"
              />
              <Button
                type="submit"
                className={BRAND_BUTTON}
                disabled={loading || code.length < 6}
              >
                {loading ? 'Verifying…' : 'Sign in'}
              </Button>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <button
                type="button"
                className="text-sm text-muted-foreground underline self-center"
                onClick={() => {
                  setSent(false);
                  setCode('');
                  setError('');
                }}
              >
                Use a different email
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
