# Architecture Decision Records

These ADRs document the default architecture and code style for a new Nx monorepo with a NestJS backend and a Next.js frontend. They are the starting point — copy into a new project, adjust the `## Status` and `## Date` of any you revisit, and add project-specific ADRs alongside them.

Each ADR opens with a **TL;DR** for quick scanning, followed by the full Context / Decision / Consequences in the classic Michael Nygard format.

## Index

| # | Title | Status |
|---|-------|--------|
| [0001](./0001-nx-monorepo-layout.md) | Nx monorepo with apps and libs layout | Accepted |
| [0002](./0002-bounded-contexts-as-libs-core.md) | Bounded contexts as `libs/core/<context>` | Accepted |
| [0003](./0003-nestjs-modular-monolith.md) | NestJS modular monolith | Accepted |
| [0004](./0004-domain-module-file-convention.md) | Domain module file convention | Accepted |
| [0005](./0005-facade-pattern-module-boundary.md) | Facade pattern as module boundary | Accepted |
| [0006](./0006-drizzle-orm-with-postgres.md) | Drizzle ORM with Postgres | Accepted |
| [0007](./0007-graphql-first-api.md) | GraphQL-first API with Apollo + class-validator | Accepted |
| [0008](./0008-domain-events-first-class.md) | Domain events as first-class artifacts | Accepted |
| [0009](./0009-event-transport-variants.md) | Event transport variants (RabbitMQ ↔ SNS/SQS) | Accepted |
| [0010](./0010-tdd-with-nestjs-test-utilities.md) | TDD with NestJS Test utilities | Accepted |
| [0011](./0011-config-via-zod-validated-env.md) | Configuration via Zod-validated env | Accepted |
| [0012](./0012-logging-nestjs-pino-per-class.md) | Logging via nestjs-pino with per-class Logger | Accepted |
| [0013](./0013-session-based-auth-passport-otp.md) | Session-based auth with Passport + custom OTP | Accepted |
| [0014](./0014-frontend-stack-plus-multi-frontend.md) | Frontend stack and multi-frontend sharing | Accepted |
| [0015](./0015-nx-tag-based-boundary-enforcement.md) | Nx tag-based boundary enforcement | Accepted |
| [0016](./0016-mcp-tools-as-first-class-providers.md) | MCP tools as first-class providers | Accepted |
| [0017](./0017-assistant-ui-with-ai-sdk.md) | In-UI AI chat with assistant-ui + Vercel AI SDK v6 | Accepted |
| [0018](./0018-ubiquitous-language-context-md.md) | Ubiquitous Language via CONTEXT.md | Accepted |
| [0019](./0019-supabase-managed-backbone.md) | Supabase as managed infrastructure backbone | Accepted |
| [0020](./0020-auth-via-supabase.md) | Auth via Supabase | Accepted |
| [0021](./0021-realtime-via-supabase-broadcast.md) | Realtime via Supabase Broadcast | Accepted |
| [0022](./0022-storage-via-supabase-storage.md) | Storage via Supabase Storage | Accepted |
| [0023](./0023-jobs-via-pgmq-pg-cron.md) | Jobs queue via pgmq + pg_cron | Accepted |

## Stack flavors

The decision space is **two-dimensional**:

| Axis | Options |
|---|---|
| **API flavor** | GraphQL-first (ADR-0007) **or** REST+MCP for AI-native projects (ADR-0016 + ADR-0017) |
| **Infra flavor** | Self-hosted / AWS-managed (default, see ADRs 0006/0009/0013) **or** Supabase-managed (ADR-0019 and its sub-ADRs) |

Both flavors share the same Nx layout, file conventions, Facade pattern, Drizzle persistence, TDD setup, `DomainEvent<T>` model, logging, and frontend stack. The differences are isolated to the ADRs above.

For a prescriptive, code-first guide aimed at AI coding agents, see [`AGENTS.md`](../../AGENTS.md).

## ADR format

These follow the classic Michael Nygard format:

- **TL;DR** — 1-2 sentence summary at the top.
- **Status** — Proposed, Accepted, Deprecated, Superseded.
- **Context** — the problem and the forces in play.
- **Decision** — the choice we made.
- **Consequences** — what we accept by making this choice.
