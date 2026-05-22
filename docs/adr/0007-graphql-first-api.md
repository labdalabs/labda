# ADR-0007: GraphQL-first API with Apollo + class-validator

## TL;DR

Apollo Server via `@nestjs/apollo` (code-first). Inputs are `@InputType`s with `class-validator` decorators; outputs are `@ObjectType`s. A global `ValidationPipe` (`whitelist + forbidNonWhitelisted + transform`) rejects unknown fields. REST is the escape hatch for OAuth, webhooks, and file uploads. DataLoaders prevent N+1 fan-out on resolver fields.

**Status:** Accepted
**Date:** 2026-05-11

## Context

The backend serves one or more Next.js frontends, and possibly multiple internal apps. REST tends to multiply endpoints and ship the wrong shape; backend-for-frontend leads to duplication; pure RPC sacrifices the field-level evolvability we want.

Requirements:

- One typed schema consumable by every frontend.
- Field-level resolution so clients fetch what they need.
- Subscriptions for live updates (chat threads, integration sync progress).
- Input validation that cannot be bypassed at the controller level.
- An escape hatch for cases GraphQL doesn't fit (OAuth callbacks, webhooks).

Apollo Server inside NestJS (`@nestjs/apollo`) gives us this. The code-first approach (`@ObjectType` + `@Field` + decorators) avoids the dual-maintenance problem of `.graphql` schema files alongside resolver classes.

## Decision

**Server stack:**

- `@nestjs/apollo` with `ApolloDriver`, code-first (`autoSchemaFile: true`).
- `@apollo/server` plumbed via `@as-integrations/express5`.
- Subscriptions over `graphql-ws` with session-decorated context. See `decorateGQLSubscriptionRequest` in `apps/core/src/app/session.helper.ts`.
- Apollo landing page enabled via `enableApolloLandingPage` config in non-prod environments.

**Validation:**

- A global `ValidationPipe` is registered as `APP_PIPE` in `libs/core/common/src/lib/common.module.ts`:
  - `whitelist: true` — unknown fields stripped.
  - `forbidNonWhitelisted: true` — unknown fields reject the request.
  - `transform: true` and `transformOptions: { enableImplicitConversion: true }` — class-validator runs and transforms.
- All inputs are `class-validator`-decorated DTOs. Resolvers declare them via `@Args('input') input: <DTO>`. The pipe validates before the resolver runs.

**Types:**

- Object types: `@ObjectType()` on the class, `@Field()` on each property, with explicit type hints for nullable / list shapes (`@Field(() => [WorkspaceMember])`).
- Input types: `@InputType()`, mirrored with class-validator decorators (`@IsEmail`, `@IsUUID`, `@IsEnum`, `@IsDateString`, `@IsOptional`).
- Enums shared with the frontend: registered via `registerEnumType(SomeEnum, { name: 'SomeEnum' })`.
- Models live in `libs/core/<context>/src/lib/<context>.models.ts`; cross-context shared enums and DTOs live in `libs/shared/isomorphic/models`.

**Resolvers:**

- One resolver class per top-level type: `@Resolver(() => Workspace)`.
- `@Query()`, `@Mutation()`, `@Subscription()`, `@ResolveField()` decorators.
- Authorization decorators from `libs/core/common`: `@Public()` (skip auth), `@Roles(UserRole.X)` (require role), `@CurrentUser()` (inject authenticated user).
- The resolver delegates to the service (not the Facade — the Facade is for OTHER modules, the resolver is internal).

**N+1 prevention:**

- The `DataLoaderInterceptor` (`libs/core/common/src/lib/dataloader/`) registers per-request loaders.
- Per-feature loaders live in `<feature>.dataloader.ts` in the owning context.

**REST controllers:**

- Used for cases GraphQL doesn't fit cleanly: OAuth callbacks, third-party webhooks (Stripe, Slack, GitHub, ...), provider-driven URLs we don't control, file uploads where multipart matters.
- Controllers are `@Controller(...)` classes; auth applies as usual unless `@Public()`.
- Versioning header (`X-API-Version`) is enabled (`apps/core/src/main.ts`) with a default version `1.0`.

**Error formatting:**

- The GraphQL `formatError` strips Apollo-internal noise, logs the original error, and returns `{ message, code, cause }` to the client (`apps/core/src/app/app.module.ts`).

## Consequences

**Accept:**

- One schema, one client cache (Apollo Client on the frontend), one type system.
- Field-level evolution is cheap; deprecations are explicit (`@Field({ deprecationReason: '...' })`).
- Validation cannot be skipped: the pipe is global and `forbidNonWhitelisted` rejects unknown fields.
- Subscriptions cost almost nothing to add when a domain event already exists — wire a `@Subscription()` to a `graphql-redis-subscriptions` PubSub topic.

**Live with:**

- Custom HTTP semantics (idempotency keys, content negotiation, file uploads, range requests) need REST or workarounds.
- N+1 risk is constant. Reviewers MUST ask "is there a dataloader for this resolved field?" on every new resolver field.
- The schema can grow unwieldy without per-context ownership; the `libs/core/<context>` boundary helps by colocating models with the resolvers that own them.
- `class-validator` decorators on input DTOs duplicate some logic with Zod schemas on the frontend; the duplication is intentional (the frontend cannot trust the server, the server cannot trust the frontend). Where possible, share enums and type unions via `libs/shared/isomorphic`.
