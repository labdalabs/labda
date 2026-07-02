import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EveChat } from '@/components/eve/eve-chat';

export default async function AssistantPage({
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
    <section className="mx-auto max-w-3xl space-y-4 p-8">
      <Link
        href={`/app/projects/${id}`}
        className="text-sm text-muted-foreground underline"
      >
        ← Back to Project
      </Link>
      <EveChat projectId={id} />
    </section>
  );
}
