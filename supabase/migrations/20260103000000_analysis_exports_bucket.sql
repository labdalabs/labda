-- Storage bucket for Analysis `.xlsx` exports (issue #9, ADR-0022).
--
-- Private bucket; the Nest backend uploads with the service-role key (bypasses
-- RLS) and hands out short-lived signed URLs. No public policies needed.
insert into storage.buckets (id, name, public)
values ('analysis-exports', 'analysis-exports', false)
on conflict (id) do nothing;
