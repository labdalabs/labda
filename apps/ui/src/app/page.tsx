import Link from 'next/link';
import { Button } from '@labda/ui/components/ui/button';
import { Dashboard } from '@/components/dashboard';
import { createClient } from '@/lib/supabase/server';

// Server Component: reads the current session via the server Supabase client.
// Unauthenticated -> minimal landing with a sign-in link.
// Authenticated   -> Dashboard demo (API call + realtime subscription + sign out).
export default async function Index() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto mt-32 max-w-md p-6 text-center">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight">labda</h1>
        <p className="mb-8 text-muted-foreground">
          A Supabase + Nest + Next.js starter. Sign in to see the dashboard demo.
        </p>
        <Button asChild>
          <Link href="/auth/sign-in">Sign in</Link>
        </Button>
      </main>
    );
  }

  return <Dashboard user={user} />;
}
