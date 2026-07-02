import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProjectsView } from '@/components/research/projects-view';

// Research workspace home. Behind Supabase auth — browsing the landing page
// needs no signup, but the workspace does.
export default async function AppHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  return <ProjectsView email={user.email ?? ''} />;
}
