# ADR-0004: Domain module file convention

## TL;DR

Every domain module follows the same 8-file shape under `libs/core/<context>/src/lib/`: `module / facade / controller / resolver / service / service.spec / queue / models`. The barrel exports only the Facade. Auth-specific guards/strategies, sub-services, and DataLoaders extend the shape using the same `<thing>.<role>.ts` naming.

**Status:** Accepted
**Date:** 2026-05-11

## Context

Without a repeatable file shape, every context invents its own layout and contributors spend cognition on placement decisions rather than logic. We want predictable navigation, a shape that mirrors NestJS responsibilities (HTTP, GraphQL, async, domain logic, DTOs), and the ability to scaffold a complete context from a template.

NestJS does not prescribe a layout. Several alternatives were considered:

- **By role, flat:** `controllers/`, `services/`, `resolvers/` directories. Mixes contexts within the same role; impossible to navigate by domain.
- **By context, hierarchical:** `<context>/{services,controllers,...}`. Predictable but adds folder depth that doesn't pay for itself; small contexts end up with many half-empty folders.
- **By context, flat with a naming convention:** `<context>/<context>.{module,service,resolver,...}.ts`. Minimum depth, maximum discoverability by suffix, easy to grep.

We chose the third because the file count per context stays small enough (8–12 typical) that one folder is preferable to a folder tree.

## Decision

Every domain module under `libs/core/<context>/src/lib/` follows this file convention:

| File | Role |
|------|------|
| `<context>.module.ts` | NestJS `@Module()` wiring providers, controllers, exports. |
| `<context>.facade.ts` | Public service-to-service API (ADR-0005). |
| `<context>.controller.ts` | REST endpoints. Omit if context has no REST surface. |
| `<context>.resolver.ts` | GraphQL queries, mutations, field resolvers. |
| `<context>.service.ts` | Business logic. The bulk of the implementation. |
| `<context>.service.spec.ts` | Unit tests (ADR-0010). |
| `<context>.queue.ts` | Async message handlers (`@RabbitSubscribe` or `@SqsMessageHandler`). |
| `<context>.models.ts` | GraphQL `@ObjectType`/`@InputType` and DTOs scoped to this context. |

The barrel `src/index.ts` re-exports only the Facade:

```ts
export * from './lib/<context>.facade';
```

Additional files MAY be added when the context legitimately needs them. Common extensions:

- **Auth-specific cross-cuts:** `<context>.guard.ts`, `<context>.serializer.ts`, `<context>.strategy.ts` (used by `libs/core/auth`).
- **Sub-services:** When a context is large enough to split internally, sub-services live in the same folder with their own file (e.g., `cart.service.ts` inside `libs/core/order/`).
- **Sub-models:** Paired with sub-services (e.g., `cart.models.ts`).
- **DataLoaders:** `<feature>.dataloader.ts` for N+1 batching in GraphQL field resolvers.
- **Integration-specific:** When a context wraps an external system, the wrapper service uses its own filename (e.g., `stripe.service.ts` inside `libs/core/billing/`).

Files NOT in the canonical 8 should still match the `<thing>.<role>.ts` pattern.

## Consequences

**Accept:**

- Any contributor opening any context finds the same shape; navigation is muscle memory.
- Search and refactors are predictable: `grep -r '.facade.ts'` lists every public API surface.
- A scaffolding generator can produce the canonical skeleton in one command (and should, in time).
- Reviewers can spot omissions at a glance — a service without a spec is a review comment.

**Live with:**

- Some contexts force placeholder files. A context with no REST surface omits the controller (fine) but if reviewers disagree on "REST or not" for a particular feature, churn ensues. The default is "GraphQL first, REST only where it makes sense" (ADR-0007).
- A very large context will outgrow the flat folder. When sub-folders become necessary (e.g., `<context>/services/`, `<context>/jobs/`, `<context>/strategies/`), the same naming convention extends: `<role>.<type>.ts` files within role folders.
