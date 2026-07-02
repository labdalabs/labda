import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/app-shell/app-shell';

// Persistent shell for the whole /app surface: the left project panel plus a
// scrollable content area. Zero-friction — browsing needs no signup, so the
// shell renders in a signed-out state too (with a Sign in action).
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <AppShell email={user?.email ?? null}>{children}</AppShell>;
}
