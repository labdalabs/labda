import { createClient } from '@/lib/supabase/server';
import { ProjectsView } from '@/components/research/projects-view';

// Research workspace home. Zero-friction: browsing needs no signup. When not
// signed in we still render the workspace shell (in a browse state); AI-backed
// and write actions prompt sign-in. This is what the VS Code plugin (issue #11)
// hosts so the panel opens with no signup.
export default async function AppHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <ProjectsView authenticated={!!user} email={user?.email ?? ''} />
  );
}
