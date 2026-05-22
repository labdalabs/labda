# ADR-0019: Supabase as managed infrastructure backbone

## TL;DR

Adopt Supabase as the managed backbone for auth, realtime, Postgres, storage, and queues — instead of stitching together self-hosted Passport+OTP, RabbitMQ, raw Postgres, S3-equivalents, and BullMQ. Drizzle, Nx, Nest, the file conventions, the Facade pattern, the `DomainEvent<T>` model, TDD, and the frontend stack are **unchanged**. This variant is orthogonal to the GraphQL-vs-REST/MCP API-flavor choice (ADR-0007 / ADR-0016): pick this for the infra layer and either API flavor on top.

**Status:** Accepted
**Date:** 2026-05-11

## Context

The standard stack assumes self-hosted Postgres, Redis, RabbitMQ (or AWS SNS+SQS), BullMQ, and a session + Passport + OTP auth path. Each of those is replaceable. Smaller teams, faster-time-to-prod projects, and projects without strict self-hosting requirements benefit from a managed alternative that covers most of the infrastructure in one place.

Supabase fits that profile: it bundles authentication, a managed Postgres, realtime fan-out, file storage, and (via the pgmq + pg_cron extensions) queues and scheduled jobs. It also ships a CLI (`supabase` + `supabase start`) that brings the whole stack up locally in Docker, matching the standard `docker-compose up` ergonomics.

This ADR establishes Supabase as a coherent variant. The sub-decisions live in their own ADRs (0020 Auth, 0021 Realtime, 0022 Storage, 0023 Queues) so each capability can be picked or skipped independently.

**Out of scope:** Supabase Edge Functions are deliberately not adopted. The Nest backend remains the source of business logic — keeping consistency with ADRs 0003 / 0004 / 0005 across both variants.

## Decision

Adopt Supabase for these five capabilities:

| Capability | Supabase service | Replaces / varies |
|---|---|---|
| Authentication | Supabase Auth | ADR-0013 (Passport + OTP session) |
| Realtime fan-out to browsers | Supabase Realtime Broadcast | New surface (live-to-browser updates); does NOT replace the backend event bus |
| Database | Supabase Postgres + Drizzle | ADR-0006, same code path |
| File storage | Supabase Storage | New capability (no main-stack equivalent) |
| Queues + scheduled jobs | pgmq + pg_cron | BullMQ + Redis (jobs); also a third option in ADR-0009 (event transport) |

### Postgres + Drizzle

Same code path as ADR-0006. The DB is hosted by Supabase; the Drizzle schema, query DSL, migrations, transactions, and `DB_CONNECTION` token are unchanged.

- The backend connects via the Supabase **transaction pooler** URL (PgBouncer in transaction mode) for short-lived queries, or the **session pooler** for connections that need session features (`LISTEN`, etc.).
- Backend uses the **service role key** (full DB access, bypasses RLS).
- Browser uses the **anon key** (subject to RLS).
- Drizzle Kit migrations are committed under `apps/<api>/migrations/` and applied via the standard `nx run <api>:migrate-run` target against the Supabase connection string.
- **Row-Level Security (RLS)** policies are written alongside the schema (typically in a separate `supabase/migrations/*.sql` file produced by `supabase db diff`). RLS is a defense-in-depth layer — the Nest backend's `@Roles()` / per-call authz remains the primary access-control surface. The two layers must stay in sync.

### Local development

`supabase start` brings up Postgres, Auth, Realtime, Storage, Studio, and the Inbucket email sink. `supabase status` prints the local credentials, which are copied into the project's `.env`. No separate `docker-compose.yml` needed for Postgres / Redis / RabbitMQ — the Supabase stack supersedes them (Redis is still needed if you keep BullMQ — see ADR-0023 for the trade-off).

### Service-role vs anon keys

- **Service-role key** — stays on the backend only. Bypasses RLS. Used for trusted server operations.
- **Anon key** — public, ships to the browser. Subject to RLS. Used by `@supabase/supabase-js` and `@supabase/ssr` on the frontend.
- **User JWT** — issued by Supabase Auth to a signed-in user. Used by both client and backend to identify the user.

The backend verifies user JWTs (ADR-0020) and uses the service-role key for its own DB/Storage/Broadcast operations. Browsers use the anon key plus their user JWT.

## Consequences

**Accept:**

- One provider covers five infrastructure capabilities. Onboarding a new project means provisioning one Supabase project, not five separate services.
- Local dev is a single `supabase start`. CI/CD points at a Supabase project per environment.
- Browser direct-connect for realtime, storage, and auth offloads round-trips that would otherwise hit the Nest backend.
- RLS policies live with the schema in version control.

**Live with:**

- **Vendor lock-in.** Migrating off Supabase later is non-trivial — every capability above has an exit path but the aggregated migration is real work. Pick this variant when you accept that.
- **Two authz layers.** Nest decorators (`@Roles`, `@CurrentUser`, per-call resource checks) AND RLS policies on the same data. They must stay aligned. Default rule: Nest is authoritative; RLS is defense-in-depth.
- **Pricing model.** Supabase is free/cheap at start, real money at scale. Run the numbers before committing.
- **Feature maturity churn.** Supabase Queues (pgmq tooling), Realtime, and Storage evolve faster than core Postgres. Pin SDK versions and read release notes when bumping.
- **Edge Functions deliberately unused.** If you genuinely need serverless functions (low-latency endpoints close to users, cron-triggered work that can't live in pg_cron), bring your own (Cloudflare Workers, Lambda) — don't mix Edge Functions with the Nest backend.

## When to pick the Supabase variant

- Small team, fast iteration, managed infra is a feature.
- Auth needs OAuth providers and you don't want to maintain Passport strategies for each.
- Frontend benefits from direct realtime / storage access without round-tripping the backend.
- Pricing model is acceptable for the expected scale.

## When to NOT pick it

- Strict self-hosting requirement (compliance, air-gap, data residency the provider can't meet).
- Multi-cloud or BYO-DB hard requirement.
- Need every piece independently replaceable without coordinated migration.

## References

- ADR-0020: Auth via Supabase
- ADR-0021: Realtime via Supabase Broadcast
- ADR-0022: Storage via Supabase Storage
- ADR-0023: Jobs queue via pgmq + pg_cron
- ADR-0006: Drizzle ORM with Postgres (unchanged; just hosted by Supabase)
- ADR-0013: Session-based auth (the main-stack variant this replaces in part)
