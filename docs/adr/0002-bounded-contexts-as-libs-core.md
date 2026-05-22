# ADR-0002: Bounded contexts as `libs/core/<context>`

## TL;DR

Each bounded context is its own Nx library under `libs/core/<context>/`, owning its module, services, API surface, async handlers, and DTOs. Cross-cutting infrastructure (DB pool, Redis, event bus, common decorators, base DTOs) lives in `libs/core/common`. File paths express the domain; the Nx graph is the architecture diagram.

**Status:** Accepted
**Date:** 2026-05-11

## Context

Following Domain-Driven Design, the codebase needs explicit module boundaries reflecting the language and ownership of distinct subdomains. A flat `apps/core/src/modules/` directory would force every contributor to fight for placement and would let cross-context coupling sneak in via casual imports.

We want each context to:

- Own its persistence schema additions, business logic, API surface, async handlers, and DTOs.
- Be removable, replaceable, and recognisable by its domain name (`auth`, `order`, `catalog`, `billing`, ...).
- Expose a narrow, deliberate public API rather than a constellation of injectable services.
- Map directly to the ubiquitous language of the product so that file paths are part of the documentation.

We also want a clear place for genuinely cross-cutting infrastructure (DB pool, Redis client, event bus, decorators, base DTOs, health indicators) that does not itself constitute a bounded context.

## Decision

Each bounded context is an Nx library at `libs/core/<context>/`. The library owns:

- A NestJS module (`<context>.module.ts`) that wires everything internal.
- A Facade (`<context>.facade.ts`) — the only exported provider (see ADR-0005).
- The business logic (`<context>.service.ts`) and its TDD spec.
- The API surface (`<context>.resolver.ts` and/or `<context>.controller.ts`).
- The async work (`<context>.queue.ts`) — Rabbit or SQS consumer.
- The context-scoped DTOs (`<context>.models.ts`).
- Anything else the context needs (guards, strategies, dataloaders, sub-services) under the same `src/lib/` folder.

The library's barrel file (`src/index.ts`) re-exports only the Facade. Internal services are not part of the public API.

Cross-cutting infrastructure that is neither a bounded context nor a sub-context lives in `libs/core/common`. By convention this includes:

- DB pool, Drizzle schema, `DB_CONNECTION` token (ADR-0006).
- Redis module and `REDIS_CLIENT` token.
- Event bus module and `EventBusService` (ADR-0007 / ADR-0008).
- Analytics module and `ANALYTICS_CLIENT` (PostHog) token.
- Pagination service, DataLoader interceptor, health indicators.
- Cross-context base classes and enums (`DomainEvent<T>`, `EventType`, `Domain`).
- Decorators (`@Public`, `@Roles`, `@CurrentUser`, `@SessionId`, `@MarketingSessionId`).

Typical starter contexts for a new project: `auth`, `workspace` (or `team`/`organization`), `integration`, and `common`. Domain-specific contexts are added as the product grows (`order`, `catalog`, `billing`, `notification`, etc.). The list is intentionally domain-driven — let the product's bounded contexts dictate the libs, not the other way around.

## Consequences

**Accept:**

- File paths express the domain. A new contributor can guess where the order placement logic lives.
- The Nx project graph is the architecture diagram; circular dependencies fail at lint time.
- Removing a context is a matter of removing one library and one import in `app.module.ts`.
- `libs/core/common` becomes the canonical home for cross-cutting concerns — fewer arguments about placement.

**Live with:**

- `libs/core/common` will accumulate utilities if discipline lapses. Treat additions to it as architectural decisions; prefer pushing utilities back into a context if they fit there.
- Splitting an existing module into two contexts requires moving files, updating `app.module.ts` imports, and (if the schema is touched) generating a migration. None of this is hard, but it is not free.
- DTOs that need to be visible to the frontend cannot live in `libs/core/<context>`; they move to `libs/shared/isomorphic/models`. The cost is the move; the benefit is keeping backend internals invisible to the client.
