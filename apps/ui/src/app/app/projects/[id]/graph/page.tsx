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
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-2.5">
        <Link
          href={`/app/projects/${id}`}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to Project
        </Link>
        <span className="text-sm font-medium">Knowledge graph</span>
      </div>
      <div className="relative flex-1">
        <KnowledgeCanvas projectId={id} />
      </div>
    </div>
  );
}
