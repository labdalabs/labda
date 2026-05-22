'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@labda/ui/components/ui/button';
import { Input } from '@labda/ui/components/ui/input';
import { createClient } from '@/lib/supabase/browser';

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

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
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
      router.push('/');
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm flex flex-col gap-6">
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
            <Button type="submit" disabled={loading || !email.trim()}>
              {loading ? 'Sending…' : 'Send code'}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
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
            />
            <Button type="submit" disabled={loading || code.length < 6}>
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
  );
}
