---
name: scaffold-bounded-context
description: Use when the user asks to "add a new bounded context", "add a domain module", "scaffold a context", "create a new feature lib under libs/core", or names a new domain like "let's add a billing context". Generates the canonical 8-file module shape with Nx tags, Facade-only exports, and a passing spec.
---

# scaffold-bounded-context

Scaffold a new bounded context as an Nx library under `libs/core/<context>/`. The output follows ADR-0004 (file convention), ADR-0005 (Facade), ADR-0015 (Nx tags) exactly.

## When to use

- The user asks for a new bounded context (e.g., "add a `billing` module", "scaffold the `notification` context").
- A product feature needs its own NestJS module with controller/resolver/service/queue and DTOs.

## Inputs to confirm

Before scaffolding, confirm with the user:

1. **Context name** (singular, snake-or-kebab — the lib path; class names will be PascalCase).
2. **API surface** — GraphQL resolver, REST controller, both, or neither.
3. **Async work** — does this context consume or publish domain events (`<context>.queue.ts`)?
4. **Frontend exposure** — will any DTOs need to live in `libs/shared/isomorphic/models`?

If the user is decisive, propose defaults: GraphQL resolver yes, REST controller no, queue file yes, isomorphic only when explicit.

## Steps

1. **Generate the lib** with Nx:

   ```bash
   pnpm nx g @nx/nest:library libs/core/<context>
   ```

2. **Set tags** in `libs/core/<context>/project.json`:

   ```json
   {
     "tags": ["scope:api", "type:domain", "target:server"]
   }
   ```

   (Use `type:feature` if this context will depend on other domain libs.)

3. **Create the 8 canonical files** under `libs/core/<context>/src/lib/`:

   - `<context>.module.ts` — exports `[<Context>Facade]` ONLY.
   - `<context>.facade.ts` — `@Injectable()` thin delegation to the service.
   - `<context>.controller.ts` — REST (skip if no REST surface).
   - `<context>.resolver.ts` — GraphQL queries/mutations (skip if no GraphQL surface).
   - `<context>.service.ts` — business logic. Injects `DB_CONNECTION`, `EventBusService`, `ANALYTICS_CLIENT` as needed.
   - `<context>.service.spec.ts` — `Test.createTestingModule` with `useValue` mocks; starts with `it('should be defined')`.
   - `<context>.queue.ts` — `@RabbitSubscribe` or `@SqsMessageHandler` handler (skip if no async work).
   - `<context>.models.ts` — GraphQL `@ObjectType` / `@InputType` and DTOs.

4. **Set the barrel** `libs/core/<context>/src/index.ts`:

   ```ts
   export * from './lib/<context>.facade';
   ```

   Facade only. Internal services are NOT exported.

5. **Register in `apps/core/src/app/app.module.ts`** (or `apps/api/src/app/app.module.ts`):

   ```ts
   import { <Context>Module } from '@<project>/core-<context>';
   // add <Context>Module to imports: [...]
   ```

6. **Run the spec** to confirm wiring:

   ```bash
   pnpm nx test core-<context>
   ```

   The smoke test should pass.

## File templates

### `<context>.facade.ts`

```ts
import { Injectable, Logger } from '@nestjs/common';
import { <Context>Service } from './<context>.service';

@Injectable()
export class <Context>Facade {
  private logger = new Logger(<Context>Facade.name);
  constructor(private readonly <context>Service: <Context>Service) {}

  // Public surface goes here. Keep it thin — delegate to the service.
}
```

### `<context>.module.ts`

```ts
import { Module } from '@nestjs/common';
import { <Context>Service } from './<context>.service';
import { <Context>Facade } from './<context>.facade';
// import { <Context>Resolver } from './<context>.resolver';
// import { <Context>Controller } from './<context>.controller';
// import { <Context>Queue } from './<context>.queue';

@Module({
  controllers: [/* <Context>Controller */],
  providers: [
    <Context>Service,
    <Context>Facade,
    // <Context>Resolver,
    // <Context>Queue,
  ],
  exports: [<Context>Facade], // Facade only
})
export class <Context>Module {}
```

### `<context>.service.ts`

```ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION, EventBusService } from '@<project>/core-common';

@Injectable()
export class <Context>Service {
  private readonly logger = new Logger(<Context>Service.name);

  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase,
    private readonly eventBusService: EventBusService,
  ) {}
}
```

### `<context>.service.spec.ts`

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { EventBusService } from '@<project>/core-common';
import { ConfigService } from '@nestjs/config';
import { <Context>Service } from './<context>.service';

describe('<Context>Service', () => {
  let service: <Context>Service;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        <Context>Service,
        { provide: 'DB_CONNECTION', useValue: { select: jest.fn().mockReturnThis(), from: jest.fn().mockReturnThis(), where: jest.fn().mockResolvedValue([]) } },
        { provide: EventBusService, useValue: { publish: jest.fn(), validateMessageString: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('configValue') } },
      ],
    }).compile();
    service = module.get(<Context>Service);
  });

  afterAll(async () => { await module.close(); });

  it('should be defined', () => { expect(service).toBeTruthy(); });
});
```

## Rules

- **DO** export only the Facade from `<context>.module.ts` and the barrel.
- **DO** tag the project at creation (`scope:api`, `type:domain` or `type:feature`, `target:server`).
- **DO** start with a passing smoke test before adding behavior.
- **DON'T** skip the Facade. There are no exceptions (ADR-0005).
- **DON'T** export internal services from the barrel.
- **DON'T** import another context's internal service — go through that context's Facade.

## References

- ADR-0002: Bounded contexts as `libs/core/<context>`
- ADR-0004: Domain module file convention
- ADR-0005: Facade pattern as module boundary
- ADR-0010: TDD with NestJS Test utilities
- ADR-0015: Nx tag-based boundary enforcement
