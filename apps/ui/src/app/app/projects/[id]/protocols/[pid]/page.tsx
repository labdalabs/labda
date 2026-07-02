import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { NotebookEditor } from '@/components/protocol/notebook-editor';

export default async function ProtocolPage({
  params,
}: {
  params: Promise<{ id: string; pid: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const { id, pid } = await params;
  return <NotebookEditor protocolId={pid} projectId={id} />;
}
