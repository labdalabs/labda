-- Storage bucket for OKF knowledge-graph exports (issue #13, ADR-0022/0025).
-- Private; the Nest backend uploads with the service-role key and hands out
-- short-lived signed URLs.
insert into storage.buckets (id, name, public)
values ('knowledge-okf', 'knowledge-okf', false)
on conflict (id) do nothing;
