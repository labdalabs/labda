import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { KnowledgeCanvas } from '@/components/knowledge/knowledge-canvas';

export default async function GraphPage({
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
  return (
    <section className="space-y-4 p-6">
      <Link
        href={`/app/projects/${id}`}
        className="text-sm text-muted-foreground underline"
      >
        ← Back to Project
      </Link>
      <KnowledgeCanvas projectId={id} />
    </section>
  );
}
