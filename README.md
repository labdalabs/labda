# labda

This is the **supabase flavor** of the dastack template: an Nx monorepo where Supabase provides the entire managed backbone — Auth, Realtime, Storage, and a Postgres database with `pgmq` + `pg_cron` for jobs. The Nest backend is REST + MCP (Vercel AI SDK + assistant-ui for the frontend chat surface). See ADRs `0019-0023` for the rationale.

> The placeholder name is `labda`. Run `scripts/init-template.sh <your-project>` after copying this directory to rename everything in one shot.

## Stack

- **Monorepo:** Nx (`apps/`, `libs/`)
- **Backend:** NestJS + REST controllers + MCP server (`@rekog/mcp-nest`) + Drizzle + Postgres
- **Frontend:** Next.js (App Router) + Tailwind + assistant-ui + Vercel AI SDK
- **Supabase:** Auth (JWT verify on Nest), Realtime (broadcast), Storage (signed URLs), `pgmq` + `pg_cron` for jobs
- **Tests:** Jest (unit), Playwright (UI e2e), supertest (API e2e)

## Layout

```
apps/
  api/                 # Nest backend (REST + MCP)
  api-e2e/             # supertest/Jest e2e
  ui/                  # Next.js frontend
  ui-e2e/              # Playwright
libs/
  core/common          # DB / health / utils / decorators — cross-cutting (ADR-0002)
  shared/client/ui     # shadcn + assistant-ui components, shared across Next apps
  shared/isomorphic/models  # Enums + types shared between server and client
supabase/
  config.toml          # `pnpm supabase start` boots Postgres / Auth / Realtime / Storage / Studio locally
```

## Getting started

```bash
# 1. Install
pnpm install

# 2. Boot Supabase locally (Postgres + Auth + Realtime + Storage + Studio + Inbucket)
pnpm supabase start

# 3. Configure
cp .env.example .env   # pnpm supabase status gives the API URL, anon key, etc.

# 4. Run migrations (after you've added Drizzle migrations)
pnpm nx run api:migrate-run

# 5. Start the backend
pnpm nx serve api

# 6. Start the frontend (in another terminal)
pnpm nx serve ui
```

- Backend API: http://localhost:3000
- Frontend: http://localhost:4200
- Supabase Studio: http://localhost:54323
- Inbucket (email): http://localhost:54324

## Wiring up the Supabase bits

This template ships scaffolding only. Use these skills to wire each integration end-to-end (each one consults the relevant ADR):

- `use-supabase-auth` — Supabase Auth + JWT verify in Nest (replaces the placeholder `current-user.decorator`).
- `use-supabase-storage` — file uploads with bucket + RLS + Drizzle metadata table.
- `use-supabase-queues` — `pgmq` polling worker and `pg_cron` scheduled enqueuer.
- `add-mcp-tool` — adds a `@Tool` to the MCP server with Zod schema + per-call user authorization.
- `add-in-ui-assistant` — wires `AssistantChatTransport` + `Thread` on the frontend.

## Architecture

All architectural decisions are in `docs/adr/`. Read `0001-nx-monorepo-layout.md` first, then follow the numbered ADRs. The supabase-specific bits are `0019` through `0023`. The `AGENTS.md` file is the prescriptive playbook for working in this codebase. `CONTEXT.md` is the project's domain glossary — fill it in as your domain language emerges.

## License

No license is committed. Add the one you want (MIT / Apache-2.0 / proprietary) before shipping anything externally.
