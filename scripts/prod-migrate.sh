#!/usr/bin/env bash
#
# Apply all migrations to the PRODUCTION Supabase database:
#   1. extensions (pgmq + pgvector) and the reference.embed pgmq queue
#   2. Drizzle app-table migrations (apps/api/migrations)
#   3. Storage buckets (analysis-exports, knowledge-okf, reference-pdfs)
#
# Run it with the Nest service's env injected (so the DB URL is never printed):
#
#   railway run --service labda -- bash scripts/prod-migrate.sh
#
# It uses the Supabase SESSION pooler (:5432) for DDL instead of the transaction
# pooler (:6543). Safe to re-run — everything is idempotent.
set -uo pipefail

# Repo root (script lives in scripts/).
cd "$(dirname "$0")/.."

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set (run via: railway run --service labda -- bash scripts/prod-migrate.sh)" >&2
  exit 1
fi

# DDL over the session pooler, not the transaction pooler.
MIGRATE_URL="${DATABASE_URL/:6543/:5432}"

echo "== 1. extensions (pgmq + pgvector) + queue =="
psql "$MIGRATE_URL" -c "create extension if not exists pgmq cascade;"
psql "$MIGRATE_URL" -c "create extension if not exists vector;"
psql "$MIGRATE_URL" -c "select pgmq.create('reference.embed');" || echo "  (queue already exists — ok)"

echo "== 2. drizzle migrate (app tables) =="
( cd apps/api && DATABASE_URL="$MIGRATE_URL" pnpm exec drizzle-kit migrate --config=drizzle.config.ts )

echo "== 3. storage buckets =="
psql "$MIGRATE_URL" -c "insert into storage.buckets (id, name, public) values
  ('analysis-exports','analysis-exports',false),
  ('knowledge-okf','knowledge-okf',false),
  ('reference-pdfs','reference-pdfs',false)
  on conflict (id) do nothing;"

echo "== 4. verify =="
psql "$MIGRATE_URL" -c "\dt public.*"
echo "Done."
