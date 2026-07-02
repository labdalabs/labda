-- Storage bucket for cached open-access Reference PDFs (issue #19, ADR-0022).
-- Private; the backend fetches lawfully-downloadable OA PDFs and serves signed
-- URLs. Never used for paywall circumvention.
insert into storage.buckets (id, name, public)
values ('reference-pdfs', 'reference-pdfs', false)
on conflict (id) do nothing;
