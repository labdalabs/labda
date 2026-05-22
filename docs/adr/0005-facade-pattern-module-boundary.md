# ADR-0005: Facade pattern as module boundary

## TL;DR

Every domain module exports exactly one provider — its `Facade`. Internal services stay private; other contexts consume the Facade only. The Facade's method surface IS the bounded context's public API and the eventual RPC contract. No exceptions — even single-context apps follow the rule.

**Status:** Accepted
**Date:** 2026-05-11

## Context

NestJS modules can export any provider in their `exports` array. With no enforced discipline, contexts end up exporting `Service`, `Repository`, `Mapper`, and even internal collaborators — and consumers begin to depend on internals. Replacing or refactoring those internals then becomes a cross-cutting change.

The bounded-context boundary needs an explicit, narrow, stable surface that other contexts depend on. The surface is part of the architecture; everything behind it is implementation.

Direct service exposure also makes it hard to introduce cross-cutting concerns (caching, logging, authorization checks, instrumentation) at the boundary. A single seam — the Facade — solves all of those.

## Decision

Every domain module exports exactly one provider: its Facade. The Facade is a thin `@Injectable()` class in `<context>.facade.ts` that delegates to internal services.

Rules:

1. The module's `exports: [...]` array contains only the Facade class.
2. The library barrel (`src/index.ts`) re-exports only the Facade.
3. Internal services (`<Context>Service`, sub-services, repositories, mappers) are providers of the module but are NOT exported.
4. Other modules consume the bounded context exclusively via the Facade. Importing an internal service from a different context is a review blocker.
5. The Facade's method surface IS the bounded context's public API. Adding a method is the deliberate act of expanding that surface. Removing a method is a coordinated change with consumers.
6. The Facade should be thin. It owns boundary-level concerns (entry-point logging, simple coordination), not business logic.

Canonical shape:

```ts
// libs/core/auth/src/lib/auth.facade.ts
@Injectable()
export class AuthFacade {
  private logger = new Logger(AuthFacade.name);
  constructor(private readonly authService: AuthService) {}

  async getUserById(userId: string): Promise<UserDTO | null> {
    this.logger.debug(`Fetching user by ID: ${userId}`);
    return this.authService.getUserDTOById(userId);
  }
}

// libs/core/auth/src/lib/auth.module.ts
@Module({
  providers: [AuthService, AuthFacade, /* ... */],
  exports: [AuthFacade], // Facade only
})
export class AuthModule {}

// libs/core/auth/src/index.ts
export * from './lib/auth.facade';
```

Where an existing module lacks a Facade, treat that as a gap to close — not a permitted variant. New contexts MUST ship with a Facade; legacy exceptions should be retrofitted opportunistically.

## Consequences

**Accept:**

- Internals can be refactored freely. Splitting `OrderService` into `OrderService` + `CartService` does not touch any consumer.
- The Facade is a natural seam for cross-cutting concerns (entry-level instrumentation, caching, authorization), added once rather than at every call site.
- Consuming contexts mock only the Facade interface in tests — small, stable, easy to fake.
- Reviewers can grep `<Context>Facade` to find every consumer; ownership of the API surface is legible.

**Live with:**

- One extra layer of indirection. The Facade is often a 5-line delegation; that is the cost of a stable boundary.
- The Facade can rot into a "god object" if every internal capability is exposed by reflex. Reviewers should challenge each new Facade method: "is this really a public capability, or just convenient?"
- Retrofitting Facades to legacy modules is real work. Sequence it: when a module is touched for unrelated reasons, take the opportunity to add the Facade.
