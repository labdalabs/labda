import { createBrowserClient } from '@supabase/ssr';

// Browser-side Supabase client. Imports from client components only.
//
//   'use client';
//   const supabase = createClient();
//   const { data: { session } } = await supabase.auth.getSession();
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  );
}
