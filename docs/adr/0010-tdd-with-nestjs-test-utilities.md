# ADR-0010: TDD with NestJS Test utilities

## TL;DR

Every service has a colocated `.spec.ts` using `Test.createTestingModule` with `useValue` mocks for `DB_CONNECTION`, `EventBusService`, `ANALYTICS_CLIENT`, and `ConfigService`. The starter test is `it('should be defined')`. Specs run fast because nothing real is booted. Query correctness needs separate integration tests against a real Postgres.

**Status:** Accepted
**Date:** 2026-05-11

## Context

We commit to TDD. Services are reasoned about and changed through tests first. The test harness must:

- Boot only the unit under test, not the whole application.
- Make external dependencies (DB, event bus, analytics, config) trivial to fake.
- Run fast enough to drive a tight red-green-refactor loop.
- Support graduation to integration tests when query correctness or transactional behavior is the unit under test.

NestJS ships `Test.createTestingModule({...}).compile()`, which gives us a Nest DI container without an HTTP server. Combined with Jest, this is the harness.

## Decision

Every domain `<context>.service.ts` has a colocated `<context>.service.spec.ts` in the same folder. The spec:

1. Composes a `TestingModule` with `Test.createTestingModule({ providers: [...] })`.
2. Provides `useValue` mocks for external dependencies. The canonical mock set is:
   - `DB_CONNECTION` — chained `jest.fn().mockReturnThis()` returning `mockResolvedValue([...])` at the final step.
   - `EventBusService` — `{ publish: jest.fn(), validateMessageString: jest.fn() }`.
   - `ANALYTICS_CLIENT` — `{ capture: jest.fn() }` (PostHog).
   - `ConfigService` — `{ get: jest.fn().mockReturnValue(...) }` and/or `getOrThrow`.
3. Retrieves the service via `module.get(<ServiceClass>)`.
4. Closes the module in `afterAll(async () => { await module.close(); })`.
5. Starts with the smoke test `it('should be defined', () => expect(service).toBeTruthy())`. New behavior is then added test-first.

A typical `<context>.service.spec.ts` template:

```ts
describe('AuthService', () => {
  let service: AuthService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: 'DB_CONNECTION', useValue: { select: jest.fn().mockReturnThis(), from: jest.fn().mockReturnThis(), where: jest.fn().mockResolvedValue([]) } },
        { provide: EventBusService, useValue: { publish: jest.fn(), validateMessageString: jest.fn() } },
        { provide: 'ANALYTICS_CLIENT', useValue: { capture: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('configValue') } },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  afterAll(async () => { await module.close(); });

  it('should be defined', () => { expect(service).toBeTruthy(); });
});
```

**Integration boundaries:**

- Pure logic and orchestration (decisions, validation, mapping) lives in services and is unit-tested with mocks.
- Query correctness (joins, indexes, locking, transaction semantics) needs integration tests. When the unit under test IS the query, use `Test.createTestingModule({ imports: [DbModule, ConfigModule.forRoot({...})] })` against a container-backed Postgres. This is the exception, not the default.
- Resolver/controller behavior (validation pipe wiring, auth guards) is exercised by app-level e2e in `apps/core-e2e/` using `supertest` against a booted Nest app.
- Frontend critical paths use Playwright e2e in `apps/<ui-app>-e2e/`.

**Test runner & layout:**

- Jest is the runner; SWC is the transformer.
- Root preset: `jest.preset.js`. Each project has `jest.config.cts` extending the preset.
- Specs run via `nx test <project>`; `nx affected:test` is the CI mode.

**Style:**

- One `describe(<ClassName>, ...)` block per spec file.
- Nested `describe` blocks for methods or scenarios.
- `it(...)` reads as a sentence describing the behavior.
- `beforeEach` builds a fresh module per test for isolation.
- Mock setup is deliberate; resist the urge to share mocks across tests beyond the `beforeEach` factory.

## Consequences

**Accept:**

- Every service has a baseline "wired correctly" smoke test from the first commit.
- The mock surface is small and consistent across the codebase — onboarding is "follow the pattern from the nearest neighbor spec."
- Tests run fast because nothing real is booted unless explicitly imported.
- Refactoring service internals does not break unrelated specs.

**Live with:**

- Mocked DB chains (`mockReturnThis().mockResolvedValue(...)`) drift from real Drizzle behavior. They prove that the service ASKED for the right thing, not that the DB ANSWERED it correctly. Integration tests are needed wherever query correctness matters.
- The spec file is mandatory. A new service without a spec fails review. The smoke test is the minimum bar.
- For services that orchestrate many collaborators, mock setup grows. When the setup dwarfs the test, that is a signal to split the service (sub-services are encouraged — see ADR-0004).
- Live integration tests require a running Postgres. CI uses an ephemeral container; local dev uses the Docker Compose stack.
