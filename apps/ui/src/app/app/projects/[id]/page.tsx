import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProjectDetail } from '@/components/research/project-detail';

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const { id } = await params;
  return <ProjectDetail projectId={id} />;
}
