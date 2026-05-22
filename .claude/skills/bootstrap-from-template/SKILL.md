---
name: bootstrap-from-template
description: Use when the user asks to "start a new project", "bootstrap a repo from this template", "scaffold a new Nx workspace", "set up a fresh project with our stack", or names a brand-new project. Copies the pre-built starter directory from `node-example/templates/supabase/`, renames the `labda` placeholder, and copies the canonical docs/ADRs/skills on top.
---

# bootstrap-from-template

Initialize a new project by copying the pre-built Supabase-flavored starter directory and renaming the `labda` placeholder. The template is a runnable Nx workspace with the canonical stack pre-wired (Supabase backbone + Nest + Drizzle + Next.js + REST + MCP + auth + event bus + queue) — copy, rename, write business logic, ship.

## When to use

- Starting a brand-new project that should follow this architecture.
- The user says "let's spin up a new repo for [product]".

## Inputs to confirm

1. **Project name** — kebab-case (e.g. `acme-app`). Becomes the npm scope (`@<project>/...`), the directory name, and the Supabase `project_id`.

## Steps

1. **Copy the starter:**

   ```bash
   PROJECT=<project>            # e.g. acme-app
   cp -R /Users/dkarasiewicz/WebstormProjects/node-example/templates/supabase ./$PROJECT
   ```

2. **Rename the `labda` placeholder:**

   ```bash
   bash /Users/dkarasiewicz/WebstormProjects/node-example/scripts/init-template.sh ./$PROJECT $PROJECT
   ```

   This rewrites:
   - `@labda/...` → `@<project>/...` (npm scope on all libs).
   - `labda` → `<project>` (Supabase `project_id`, docs).
   - `Labda` → `<PascalCase>` (occasional code references).
   - Skips `pnpm-lock.yaml` so it regenerates cleanly on the next `pnpm install`.

3. **Copy the documentation skeleton:**

   ```bash
   cp -R /Users/dkarasiewicz/WebstormProjects/node-example/docs ./$PROJECT/
   cp /Users/dkarasiewicz/WebstormProjects/node-example/AGENTS.md ./$PROJECT/
   cp /Users/dkarasiewicz/WebstormProjects/node-example/CONTEXT.md ./$PROJECT/
   mkdir -p ./$PROJECT/.claude
   cp -R /Users/dkarasiewicz/WebstormProjects/node-example/.claude/skills ./$PROJECT/.claude/
   ```

   The template intentionally doesn't ship `docs/adr/` — the canonical ADRs live in `node-example/docs/adr/` and are copied here so every new project starts on day 1 with the full template.

4. **Init git, install deps, boot Supabase:**

   ```bash
   cd ./$PROJECT
   git init && git add -A && git commit -m "chore: bootstrap from template"
   pnpm install
   pnpm supabase start            # boots Postgres/Auth/Realtime/Storage/Studio/Inbucket locally
   pnpm supabase status           # copy URL + keys into .env (uses .env.example as the schema)
   ```

5. **Run migrations + start the dev loop:**

   ```bash
   pnpm nx run api:migrate-run
   pnpm nx serve api              # backend on localhost:3000
   pnpm nx serve ui               # frontend on localhost:4200 (other terminal)
   ```

6. **Fill in `CONTEXT.md`** with the project's actual domain language. Lead with 2-3 core terms; add more as they emerge. Run the `update-context-md` skill iteratively.

7. **Scaffold the first bounded context** with `scaffold-bounded-context` (typically the one that owns the product's main entity).

## What's already in the template

| | Provided |
|---|---|
| Backend app | `apps/api` — Nest with global validation, request-id, pino-pretty logger |
| Frontend app | `apps/ui` — Next.js, Tailwind, shared `@<project>/models` |
| Cross-cutting infra | `libs/core/common` — DB module, decorators (`@Public`, `@CurrentUser`, `@Roles`), pagination, timeout, health |
| Auth | Supabase JWT strategy + global `MainAuthGuard` registered as `APP_GUARD` (verifies access token, populates `req.user`). `@Public()` to opt out per route. |
| Event bus | Supabase Realtime private channel + `@OnDomainEvent('subject.verb')` decorator. Typed `DomainEvent<T>` base. |
| Queue | pgmq + `@QueueHandler('queue-name')` decorator. Polling worker with retries via visibility timeout. |
| Database | Drizzle, migrations target in `apps/api`, schema in `libs/core/common/db/schema.ts` |
| API | Nest REST controllers + MCP server (`@rekog/mcp-nest`) wired at `/mcp` |
| Validation | Global `ValidationPipe` (whitelist + transform + forbidNonWhitelisted) + Zod for env |
| Local infra | `pnpm supabase start` boots everything in Docker |
| CI | Nx tag-based boundary enforcement (ADR-0015) + Jest preset + Playwright e2e |

## Add features with skills

- **Auth provider config** — `use-supabase-auth` flips on the providers you need (magic link, GitHub, Google, etc.).
- **File uploads** — `use-supabase-storage` creates a bucket + Drizzle metadata table + signed-URL flow.
- **More queues** — `use-supabase-queues` adds a new pgmq queue + `@QueueHandler` worker + (optional) `pg_cron` enqueuer.
- **New bounded context** — `scaffold-bounded-context` generates the 8-file canonical shape.
- **MCP tools** — `add-mcp-tool` adds a `@Tool` to the MCP server with Zod params + per-call user auth.
- **AI chat UI** — `add-in-ui-assistant` wires `AssistantChatTransport` + `Thread` on the frontend.
- **Domain events** — `add-domain-event` adds a typed event to the bus.
- **Drizzle tables** — `add-drizzle-table` adds a table + generates the migration.
- **GraphQL** — `add-graphql-operation` adds Apollo to the API (default is REST + MCP).
- **REST endpoint** — `add-rest-endpoint` adds a controller with class-validator DTOs + auth.

## Rules

- **DO** rename via `scripts/init-template.sh`, not by hand. The script catches the Supabase `project_id`, docker name suffixes, and npm scopes that a human will miss.
- **DO** copy `docs/adr/`, `AGENTS.md`, `CONTEXT.md`, and `.claude/skills/` from `node-example`. The template ships without them on purpose.
- **DON'T** copy `MEMORY.md` or anything from `~/.claude/projects/`. Those are user-machine-specific.
- **DON'T** edit files under `node-example/templates/supabase/` directly unless you're updating the template itself (in which case verify with `pnpm install` + `nx build` in a scratch copy first).

## Updating the template

When you discover something missing or wrong while using a new project, fix it in `node-example/templates/supabase/` so the next bootstrap inherits the fix. To verify:

```bash
SCRATCH=$(mktemp -d)
cp -R /Users/dkarasiewicz/WebstormProjects/node-example/templates/supabase/. $SCRATCH/
bash /Users/dkarasiewicz/WebstormProjects/node-example/scripts/init-template.sh $SCRATCH verify-app
cd $SCRATCH && pnpm install && pnpm nx run-many -t build lint
```

## References

- All ADRs in `docs/adr/` (specifically 0019–0023 for the Supabase backbone, auth, realtime, storage, jobs).
- `scripts/init-template.sh` for the rename mechanics.
- The reference project this template was lifted from: realsheet @ `8419947`.
