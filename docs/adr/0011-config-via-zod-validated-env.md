# ADR-0011: Configuration via Zod-validated env

## TL;DR

`apps/core/src/app/configuration.ts` exports `config()` (POJO from env) and `validate()` (Zod `safeParse` that throws on failure). The process exits before serving traffic if env is malformed. Zod for boot-time env, `class-validator` for runtime DTOs — clean split, idiomatic in both places.

**Status:** Accepted
**Date:** 2026-05-11

## Context

Environment variables are stringly-typed and easy to mistype. Missing required config should fail at boot, not at the first request that needs it. NestJS `ConfigService` provides the plumbing (`load: [...]`, `get('dot.path')`) but no validation.

We already use `class-validator` for runtime DTOs and event payloads (ADR-0007, ADR-0008). Reusing it for env would conflate two distinct concerns: runtime input validation (incoming HTTP/GraphQL/queue payloads) versus boot-time configuration validation (the shape of the environment the process starts in).

Zod is the right tool for the second: plain object shape, precise transforms (number-from-string, boolean-from-string), good error messages, no decorators.

## Decision

`apps/core/src/app/configuration.ts` exports two things:

1. **`config()`** — a factory that builds a POJO from `process.env`. It parses numbers, splits comma-lists, narrows booleans (`process.env.X === 'true'`), and groups settings into namespaces (`session`, `cors`, `database`, `eventBus`, `cache`, `integrations`, `ai`, etc.).
2. **`validate()`** — a function that runs a Zod `configSchema.safeParse(config())`. On failure it throws with the parse error message; the process exits before serving traffic.

These are wired into `ConfigModule`:

```ts
ConfigModule.forRoot({
  isGlobal: true,
  cache: true,
  load: [config],
  validate,
})
```

Services read config via `configService.get('<dotted.path>')` for optional values or `configService.getOrThrow('<dotted.path>')` for values that must be present.

**Conventions:**

- Environment variable names use `UPPER_SNAKE_CASE` with namespace prefixes (`DATABASE_*`, `SESSION_*`, `CORS_*`, `INTEGRATION_ENCRYPTION_KEY`, `PRIMARY_MODEL_API_KEY`).
- Optional integrations are conditional in the factory: `linear: process.env.LINEAR_CLIENT_ID ? { ... } : undefined`.
- The Zod schema marks the integration block `.optional()` for each integration so the absence of a third-party config does not break boot.
- `.env.example` is the canonical reference and must stay in sync with the schema. Reviewers should reject schema changes that don't update `.env.example`.

**When to use class-validator vs Zod:**

- **Zod:** environment variables, JSON schemas at trust boundaries that are shaped as objects rather than classes, frontend form schemas (often shared with the backend through `libs/shared/isomorphic`).
- **class-validator:** NestJS DTOs (request bodies, GraphQL `@InputType`, event payloads), where decorators are idiomatic and the `ValidationPipe` integration is needed.

Both libraries are present in `dependencies`. The split keeps each one's responsibilities clear.

## Consequences

**Accept:**

- The process fails fast at boot if env is malformed or required values are missing.
- The Zod schema is documentation of every supported env var, in TypeScript, type-checked.
- Local dev (`logPretty=true`, `enableApolloLandingPage=true`) and prod (`secure=true`, `trustProxy=true`, `ssl=true`) configurations are explicit and tested by parse.
- Adding a new env var is a 3-step change: env, factory, schema. Reviewers see all three or reject the PR.

**Live with:**

- Two validation libraries — but with clear, non-overlapping roles.
- `configService.get('a.b.c')` is stringly-typed at the call site. No automatic key inference today; a future improvement could generate a typed `AppConfig` from the Zod schema and provide a typed `configService<AppConfig>`.
- Secrets must NOT live in `.env.example`. The example uses placeholders (`changeme`, `<value>`). Reviewers should flag any commit that contains a real key.
- Some optional integrations (OAuth providers, third-party APIs like Linear/Slack/Google/GitHub/Stripe) require coordinated env across multiple variables. The schema should enforce "all or none" for those groups via the conditional factory; partial config silently disables the integration. Document the toggle in the integration's README.
