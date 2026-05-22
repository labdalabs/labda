---
name: architecture-review
description: Use when the user asks to "review architecture", "audit the branch", "check against ADRs", "compliance review", or wants a sanity check on a PR before merging. Walks the diff against all 18 ADRs and reports concrete violations with file:line citations.
---

# architecture-review

Audit a branch or set of changes against the project's ADRs. Output is a punch list of concrete violations with `file:line` citations and a fix suggestion for each.

## When to use

- Before merging a non-trivial PR.
- When onboarding new code into the repo.
- When the user suspects drift from the documented patterns.
- After a refactor, as a regression check.

## Inputs to confirm

- **Scope** — the whole branch since `main`, a specific PR number, or a list of files.
- **Severity threshold** — flag everything, or only Critical and High?

## Checklist (organized by ADR)

For each item, scan the diff (or files) and report violations.

### Layout & boundaries

- **[ADR-0001]** New apps under `apps/`, new libs under `libs/`. No code outside this layout.
- **[ADR-0002]** Each bounded context is its own `libs/core/<context>/` lib. No business logic in `apps/core/src/`.
- **[ADR-0015]** Every new project has `tags: ["scope:*", "type:*", "target:*"]` in `project.json`. Run `nx graph` to confirm boundaries hold.

### Domain module shape

- **[ADR-0004]** A new context has the 8 canonical files (allow omissions for controller/queue when the context legitimately has no REST/async surface).
- **[ADR-0005]** `<context>.module.ts` `exports: [<Context>Facade]` — Facade only. The barrel `src/index.ts` exports only the Facade. No exceptions.

### Persistence

- **[ADR-0006]** Drizzle is used (not raw `pg`, not another ORM). Multi-write operations are wrapped in `db.transaction(async (tx) => ...)`. Schema changes have a committed migration.

### API

- **[ADR-0007]** GraphQL inputs use `@InputType` + `class-validator` decorators. Outputs use `@ObjectType`. No raw `any` in resolver signatures.
- **[ADR-0007]** REST controllers exist only for OAuth callbacks, webhooks, file uploads, or other GraphQL-incompatible cases.
- **[ADR-0007]** Resolved nested fields use a DataLoader (look for `*.dataloader.ts` in the context).

### Events

- **[ADR-0008]** New events are class instances of `DomainEvent<TPayload>`, NOT plain objects. Payload fields have class-validator decorators. The event is in the `EventType` enum, `EventTypeToDomainEventMap`, and the `DomainEventType` union.
- **[ADR-0008]** Events are published inside the originating transaction.
- **[ADR-0009]** Consumer decorator matches the project's transport choice.

### Testing

- **[ADR-0010]** Every new `<context>.service.ts` has a `<context>.service.spec.ts` with at least the `should be defined` smoke test. Specs use `Test.createTestingModule` with `useValue` mocks.

### Cross-cutting

- **[ADR-0011]** New env vars are in `configuration.ts`, the Zod schema, AND `.env.example`. None missing.
- **[ADR-0012]** Per-class loggers (`new Logger(<Class>.name)`). No `console.log`. No secrets/tokens/OTP codes in log calls.
- **[ADR-0013]** Routes are auth'd by default (global guard); `@Public()` is justified at each use site. Multi-tenant resolvers verify the user's scope against the resource.

### Frontend

- **[ADR-0014]** Shared isomorphic types live in `libs/shared/isomorphic/models`. Frontend forms use Zod schemas shared with the backend when applicable.
- **[ADR-0014]** New shared frontend libs are tagged correctly (`scope:shared` or `scope:ui`, `target:client` or `target:isomorphic`).

### AI surfaces (when applicable)

- **[ADR-0016]** MCP tools are `@Injectable` classes with one `@Tool()` method; parameters validated via Zod; per-call user authz check exists.
- **[ADR-0016]** Tools delegate to services, not the DB directly.
- **[ADR-0017]** In-UI assistant tools call the same services as REST/MCP. The assistant runs in the user's session (no parallel identity).

### Ubiquitous language

- **[ADR-0018]** New domain terms appear in `CONTEXT.md`. Code uses the canonical term; "Avoid" synonyms are absent. Reviewers flag terms missing from the glossary.

## How to investigate

1. Get the diff:
   ```bash
   git diff main...HEAD --stat
   git diff main...HEAD --name-only
   ```
2. For each changed file, identify its role (`<context>/<role>.ts`) and apply the matching checks above.
3. For new directories, check `project.json` tags before reading the code.
4. Run `pnpm nx affected:lint` and `pnpm nx affected:test` to catch the mechanical violations.
5. For each violation, cite `<file>:<line>` and propose the one-line fix.

## Output format

Group violations by severity:

```
## Critical
- libs/core/order/src/index.ts:3 — exports `OrderService` directly. Should export only `OrderFacade` (ADR-0005). Fix: change to `export * from './lib/order.facade';`.

## High
- libs/core/order/src/lib/order.service.ts:118 — `db.insert(...)` followed by `db.insert(...)` outside a transaction (ADR-0006). Wrap both writes in `db.transaction(async (tx) => ...)`.

## Medium
- apps/core/src/app/configuration.ts:42 — new env var `STRIPE_WEBHOOK_SECRET` not in `.env.example` (ADR-0011).

## Nits
- ...
```

End with a count: "12 violations: 1 Critical, 3 High, 5 Medium, 3 Nits."

## Rules

- **DO** cite `file:line` for every violation. No vague claims.
- **DO** propose a concrete fix, not just "violates ADR-X".
- **DO** group by severity so the user can triage.
- **DON'T** flag stylistic nits if the user asked for "Critical + High only".
- **DON'T** invent violations. If you're unsure, mark "needs clarification" and ask.

## References

All 18 ADRs in `docs/adr/`. Read them before reviewing if you're not confident on a check.
