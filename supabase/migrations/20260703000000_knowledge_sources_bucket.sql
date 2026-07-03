-- Storage bucket for source files (PDF/CSV/…) attached to authored knowledge
-- nodes. Private, with owner-scoped RLS so the browser can upload and read its
-- own files directly (files live under a `<userId>/` prefix). A node stores the
-- object path as its `sourceRef`; the client resolves a short-lived signed URL
-- to open it.
insert into storage.buckets (id, name, public)
values ('knowledge-sources', 'knowledge-sources', false)
on conflict (id) do nothing;

create policy "knowledge-sources owner read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'knowledge-sources'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "knowledge-sources owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'knowledge-sources'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
