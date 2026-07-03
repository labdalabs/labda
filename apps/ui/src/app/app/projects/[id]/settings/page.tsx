import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProjectSettings } from '@/components/research/project-settings';

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/sign-in');

  const { id } = await params;
  return <ProjectSettings projectId={id} />;
}
