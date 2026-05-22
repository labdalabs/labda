-- Enable Supabase-managed Postgres extensions used by the template.
--
-- pgmq    — Postgres-native message queue (ADR-0023). The Nest QueueWorker
--           polls pgmq.read; QueueService publishes via pgmq.send.
-- pg_cron — scheduled SQL execution. Use to enqueue messages on a cron from
--           inside the database (e.g. nightly cleanup) so no external scheduler
--           is required.

create extension if not exists pgmq cascade;
create extension if not exists pg_cron;

-- Create the default queues the template references. Add your own with
-- `select pgmq.create('<queue-name>');` in a new migration when you wire a new
-- `@QueueHandler('<queue-name>')`.
--
-- Example: select pgmq.create('user.welcome-email');
