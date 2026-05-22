# AGENTS.md — coding agent playbook

This document is the prescriptive companion to the [ADRs](./docs/adr/README.md). It tells a coding agent (human or AI) how to write code in this style, with concrete recipes, code shapes, and rules. The ADRs explain **why**; this file explains **how**.

For specific recurring tasks, also see the project-scoped Claude Code skills in [`.claude/skills/`](./.claude/skills/README.md) — each is invocable as `/<skill-name>` and gets picked up automatically by Claude when the user's request matches. The skills are the operational surface for the recipes in this file.

The stack has **two orthogonal axes**. Pick one option on each axis:

**API flavor:**

- **Standard (GraphQL-first):** NestJS + Apollo GraphQL + class-validator inputs + REST escape hatch. Use for product backends that don't need external AI tool integration.
- **AI-native (REST + MCP):** NestJS + REST controllers + MCP server (`@rekog/mcp-nest`) + Vercel AI SDK for the in-UI assistant. Use when external AI agents need to call your capabilities, or when an in-product assistant is the main UX.

**Infra flavor:**

- **Self-hosted / AWS-managed (default):** Postgres + Redis + RabbitMQ (or SNS+SQS) + BullMQ + Passport+OTP for auth. Docker Compose locally; SST + AWS in prod.
- **Supabase-managed:** Supabase Auth + Realtime + Postgres + Storage + pgmq/pg_cron for queues. `supabase start` locally; a Supabase project in prod. See ADRs 0019–0023.

Both flavors on both axes share the same Nx layout, file conventions, Facade pattern, Drizzle persistence, TDD setup, logging, config, `DomainEvent<T>` model, and frontend stack. The differences are called out in the ADRs they affect.

**Before writing code**, read the project's `CONTEXT.md` if it exists (the Ubiquitous Language glossary — ADR-0018). Use its vocabulary in everything you produce. Flag conflicts with existing ADRs explicitly rather than silently overriding.

---

## Tech stack at a glance

**Backend (`apps/core` or `apps/api`)**
- NestJS 11
- API: code-first GraphQL via `@nestjs/apollo` (standard flavor), or REST + MCP server via `@rekog/mcp-nest` (AI-native flavor)
- Drizzle ORM + `pg` Pool + Postgres
- Event bus: RabbitMQ (`@golevelup/nestjs-rabbitmq`) or AWS SNS+SQS FIFO; omitted in single-context AI-native apps
- Sessions: `express-session` + `connect-redis` + Passport (OTP and/or OAuth strategies)
- Logging: `nestjs-pino`
- Config: Zod-validated env via `@nestjs/config`
- Jobs: `@nestjs/bullmq` + `bullmq` (Redis-backed)
- Cache: `@nestjs/cache-manager` + `@keyv/redis`
- Health: `@nestjs/terminus`
- Scheduling: `@nestjs/schedule`
- AI: `ai` + `@ai-sdk/anthropic` + `@assistant-ui/react-ai-sdk` (in-UI), `@rekog/mcp-nest` + `@modelcontextprotocol/sdk` (external MCP), `@langchain/langgraph` + `deepagents` (graph-based agents)

**Frontend (`apps/<ui-app>` or `apps/ui`)**
- Next.js 16 + React 19
- Apollo Client (`@apollo/client` + `@apollo/client-integration-nextjs`) for GraphQL projects
- Tailwind v4 + Radix UI + shadcn (copy-in)
- Zustand for client state
- `react-hook-form` + `zod` for forms
- `next-themes` (dark default), `sonner`, `cmdk`, `vaul`
- `@assistant-ui/react` + `@assistant-ui/react-ai-sdk` when there's an in-UI chat
- Playwright e2e

**Build**
- Nx 22 monorepo, pnpm, SWC, Webpack with HMR for Nest

---

## Mental map: where things live

```
apps/
  core/                                      NestJS backend
    src/main.ts                              bootstrap (session middleware, helmet, shutdown hooks)
    src/app/app.module.ts                    root module (composes everything)
    src/app/configuration.ts                 Zod-validated env (config() + validate())
    src/app/session.helper.ts                session + passport + marketing cookie helpers
    drizzle.config.ts                        migration tooling
    migrations/                              generated SQL migrations
  core-e2e/                                  backend e2e via supertest
  <ui-app>/                                  Next.js frontend(s)
  <ui-app>-e2e/                              Playwright e2e

libs/
  core/<context>/src/lib/                    each bounded context (auth, workspace, order, ...)
    <context>.module.ts                      Nest module, exports Facade only
    <context>.facade.ts                      public service-to-service API
    <context>.controller.ts                  REST (optional)
    <context>.resolver.ts                    GraphQL queries/mutations
    <context>.service.ts                     business logic
    <context>.service.spec.ts                unit tests
    <context>.queue.ts                       Rabbit/SQS consumer (optional)
    <context>.models.ts                      @ObjectType / @InputType / DTOs
    <feature>.dataloader.ts                  DataLoader for N+1 (optional)
  core/common/src/lib/                       cross-cutting infra
    db/                                      DB_CONNECTION, schema, tokens
    redis/                                   REDIS_CLIENT, module
    eventbus/                                EventBusService, exchange token
    analytics/                               ANALYTICS_CLIENT (PostHog)
    decorators/                              @Public, @Roles, @CurrentUser, @SessionId, ...
    health/                                  Terminus indicators
    models/                                  DomainEvent<T>, EventType, Domain
    interfaces/                              shared TS interfaces
    utils/                                   PaginationService, timeout helpers
    dataloader/                              DataLoaderInterceptor + decorator
    jobs/                                    BullMQ module + tokens
  shared/isomorphic/models/                  enums and DTOs shared with frontend
  shared/client/ui/                          shared frontend code (single-frontend projects)
  shared/client/{providers,hooks,components,utils}/  shared frontend infra (multi-frontend projects)
  shared/client/<domain>-idb/                offline-first IndexedDB layers (opt-in)
  <app>/{components,hooks,providers,store}/  per-app feature libs (multi-frontend)
  packages/sdk/                              publishable SDK (optional)
  infra/, lambdas/                           AWS deployment artifacts (e.g., SST)
```

---

## Recipes

### Add a new bounded context

1. Generate the lib:
   ```bash
   pnpm nx g @nx/nest:library libs/core/<context>
   ```
2. Create the canonical 8 files under `libs/core/<context>/src/lib/` (omit `queue.ts` if there's no async work, omit `controller.ts` if there's no REST surface). Use an existing well-shaped module (e.g., `auth`) as a copy template.
3. Barrel: `libs/core/<context>/src/index.ts` exports ONLY the Facade.
4. Import the module in `apps/core/src/app/app.module.ts`.
5. If the context owns persistence, add tables to `libs/core/common/src/lib/db/schema.ts` and generate a migration:
   ```bash
   pnpm nx run core:drizzle-generate
   ```
6. Write the spec first. Make it pass.

### Add a domain event

1. **Enum entry.** Add the event name to `EventType` in `libs/core/common/src/lib/models/domain.model.ts`. Past tense: `INVOICE_PAID`, `ORDER_CANCELED`.
2. **Payload class.** Decorate every field with class-validator:
   ```ts
   export class InvoicePaidEventPayload {
     @IsUUID()  invoiceId!: string;
     @IsUUID()  workspaceId!: string;
     @IsString() amountCents!: string;
     @IsDateString() paidAt!: string;
     @IsDateString() emittedAt!: string;
   }
   ```
3. **Event class.** Extend `DomainEvent<YourPayload>`. The constructor hard-codes `version`, `eventType`, `origin`, and builds the payload via `plainToInstance`:
   ```ts
   export class InvoicePaidEvent extends DomainEvent<InvoicePaidEventPayload> {
     @Type(() => InvoicePaidEventPayload)
     payload!: InvoicePaidEventPayload;
     constructor(payload: Pick<InvoicePaidEventPayload, keyof InvoicePaidEventPayload>, userId?: string) {
       super(randomUUID(), EventVersion.V1, EventType.INVOICE_PAID, Domain.BILLING, userId);
       this.payload = plainToInstance(InvoicePaidEventPayload, payload);
     }
   }
   ```
4. **Map entry.** Add to `EventTypeToDomainEventMap` so consumers can deserialize:
   ```ts
   [EventType.INVOICE_PAID]: InvoicePaidEvent,
   ```
5. **Union member.** Add to `DomainEventType` union.
6. **Publish.** From the originating service, inside its transaction:
   ```ts
   await this.eventBusService.publish(new InvoicePaidEvent({ ... }, actingUserId));
   ```
7. **Consume.** In the receiving context's `<context>.queue.ts`, add a `case EventType.INVOICE_PAID` to the switch.

### Add a GraphQL query or mutation

1. Add the input/output types to `libs/core/<context>/src/lib/<context>.models.ts`:
   ```ts
   @InputType()
   export class CancelOrderInput {
     @Field() @IsUUID() orderId!: string;
     @Field({ nullable: true }) @IsString() @IsOptional() reason?: string;
   }
   ```
2. Add the resolver method. Use the right authorization decorators:
   ```ts
   @Roles(UserRole.WORKSPACE_ADMIN)
   @Mutation(() => Boolean)
   async cancelOrder(
     @CurrentUser() user: AuthenticatedUser,
     @Args('input') input: CancelOrderInput,
   ): Promise<boolean> {
     await this.orderService.cancelOrder(user.userId, input);
     return true;
   }
   ```
3. Add the service method. Inside a transaction if multi-write.
4. Spec the service method.

### Add a REST endpoint

Reserve REST for OAuth callbacks, webhooks, file uploads, and provider-driven URLs. For everything else, prefer GraphQL.

```ts
@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Public()
  @Post()
  @HttpCode(200)
  async handleWebhook(@Headers('stripe-signature') sig: string, @Req() req: RawBodyRequest<Request>) {
    await this.subscriptionService.processStripeWebhook(sig, req.rawBody!);
  }
}
```

Versioning is header-based (`X-API-Version`, default `1.0`); declare endpoint versions when they diverge.

### Add a Drizzle table

1. Add the table definition to `libs/core/common/src/lib/db/schema.ts`:
   ```ts
   export const invoice = pgTable('invoice', {
     id: uuid('id').primaryKey(),
     workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
     amountCents: numeric('amount_cents', { precision: 12, scale: 0 }).notNull(),
     status: text('status').notNull(),
     createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
     updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
   });
   ```
2. Re-export from the `libs/core/common` barrel if not already.
3. Generate the migration:
   ```bash
   pnpm nx run core:drizzle-generate
   ```
4. Review the generated SQL under `apps/core/migrations/` and commit it.
5. Apply locally:
   ```bash
   pnpm nx run core:drizzle-migrate
   ```

### Add an MCP tool (AI-native projects)

External AI agents call MCP tools over HTTP. See ADR-0016.

1. **Create the tool file.** Colocate under the owning context: `libs/api/<context>/src/lib/mcp/<tool-name>.tool.ts`.
2. **Define the parameter schema with Zod** (top-level `const` so the type can be `z.infer`'d for the method signature). MCP requires JSON-Schema-compatible schemas; Zod gives that for free.
3. **Implement the tool as an `@Injectable()` class** with one `execute(params, _ctx, req)` method decorated `@Tool({ name, description, parameters })`. Names are snake_case verbs (`update_item`, `list_items`). Descriptions and parameter `.describe()` strings are part of the public contract — write them like API docs.
4. **Enforce per-call authorization.** Read `req.user` (set by the standard `MainAuthGuard` — ADR-0013). For scoped resources, verify the user has access:
   ```ts
   const user = req?.user;
   if (!user) throw new UnauthorizedException();
   await this.workspaceAccess.assertCanEdit(user.userId, params.workspaceId);
   ```
5. **Delegate to the service.** Tools are thin adapters; business logic stays in the underlying service. The same service must power HTTP controllers and the in-UI AI agent.
6. **Register the tool** in the owning module via `McpModule.forFeature([YourTool, ...], '<server-name>')`. The server name must match `McpModule.forRoot({ name })` in `app.module.ts`.
7. **Add it as a provider** so DI works.

External AI agents authenticate via OAuth, like any other third-party integration — not via a parallel identity model. Treat them as OAuth clients acting on behalf of a user.

### Add the in-UI AI assistant (AI-native projects)

The in-UI chat uses `assistant-ui` + Vercel AI SDK v6. See ADR-0017.

**Backend (`AgentService` + `AgentController`):**

1. Inject the model: `createAnthropic({ apiKey: configService.getOrThrow('anthropic.apiKey') })`.
2. `streamText({ model, system, messages: await convertToModelMessages(messages), tools, stopWhen: stepCountIs(MAX_STEPS) })`.
3. Define tools inline with `tool({ description, inputSchema: zodSchema, execute })`. Tools call the same services as MCP tools and HTTP controllers — one source of truth.
4. The assistant runs in the user's session. Tools receive the authenticated `user` and call services with that user as the caller. No separate identity is derived.
5. If the audit log needs to distinguish a user-typed write from an assistant-triggered write, pass a `source: 'assistant' | 'user'` flag into the service. The identity stays the same; the source is metadata.
6. Override the global `ValidationPipe` per-controller — assistant-ui posts extras beyond `messages`:
   ```ts
   @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
   ```
7. Stream back: `result.pipeUIMessageStreamToResponse(res)`.

**Frontend:**

1. `AssistantChatTransport({ api: '/api/nest/.../chat', fetch })` — the custom `fetch` attaches `Authorization: Bearer <session/OAuth token>`.
2. `useChatRuntime({ transport })` and wrap with `<AssistantRuntimeProvider runtime={runtime}>`.
3. Use `<Thread />` from the shared assistant-ui components in `libs/shared/client/ui/.../assistant-ui`.

### Add a queue consumer

Each bounded context owns one queue file. RabbitMQ version:

```ts
@Injectable()
export class OrderQueue {
  private readonly logger = new Logger(OrderQueue.name);
  constructor(private readonly orderService: OrderService) {}

  @Public()
  @RabbitSubscribe({
    exchange: EVENT_BUS_EXCHANGE,
    routingKey: 'events.#',
    queue: `${Domain.ORDER}-domain-queue`,
    errorBehavior: MessageHandlerErrorBehavior.REQUEUE,
  })
  async handleMessage(event: DomainEventType) {
    this.logger.debug({ event }, 'Received domain event');
    switch (event.eventType) {
      case EventType.PAYMENT_CAPTURED: {
        await this.orderService.markPaid((event as PaymentCapturedEvent).payload.orderId);
        break;
      }
    }
  }
}
```

SQS version (AWS): same shape, decorator is `@SqsMessageHandler(QUEUE_ORDER, true)`, and the body must be `JSON.parse`'d and passed through `eventBusService.validateMessageString(body.Message)` before the switch.

### Add a frontend feature

1. If it talks to the API: write the GraphQL query/mutation in `<feature>.graphql.ts` (codegen) or as a `gql\`...\`` template colocated with the component.
2. Form? `react-hook-form` + `zod` + `@hookform/resolvers/zod`. Share the schema with the backend via `libs/shared/isomorphic` when applicable.
3. Need state outside React's tree? Create a small Zustand store in the right scope (`libs/<app>/store` or `libs/shared/client/utils`).
4. UI: shadcn-style components from `libs/shared/client/ui` (or copy-in from `pnpm dlx shadcn add ...`). Compose, don't build new primitives unless necessary.
5. Server component for shells/layout. Client component (`'use client'`) for anything interactive.

---

## Code style

### Naming

| Thing | Convention | Example |
|-------|-----------|---------|
| File | `kebab-case`, role suffix | `auth.service.ts`, `order.dataloader.ts` |
| Class | `PascalCase`, role suffix | `AuthService`, `OrderDataLoader`, `InvoicePaidEvent` |
| DI token | `UPPER_SNAKE_CASE` | `DB_CONNECTION`, `REDIS_CLIENT`, `ANALYTICS_CLIENT` |
| Env var | `UPPER_SNAKE_CASE`, namespace prefix | `DATABASE_HOST`, `SESSION_SECRET` |
| GraphQL type | `PascalCase` | `Workspace`, `CreateOrderInput` |
| GraphQL field | `camelCase` | `workspaceId`, `createdAt` |
| Domain event | Past tense `<Subject><Verb>Event` | `WorkspaceCreatedEvent`, `OrderCanceledEvent` |
| Queue | `<DOMAIN>-domain-queue` (Rabbit) / `Core<Domain>Queue` (SST) | `AUTH-domain-queue` / `CoreOrderQueue` |
| Drizzle table | `camelCase` TS, `snake_case` SQL | `workspaceMembership` → `workspace_membership` |

### Logging

```ts
private readonly logger = new Logger(MyClass.name);

this.logger.error('Failed to send OTP', { email, error });
this.logger.debug(`User authenticated`, { userId });
this.logger.log({ workspaceId, name }, `Created workspace "${name}"`);
```

- Per-class `Logger`, always with `<Class>.name`.
- Structured context as an object.
- Never log secrets, tokens, OTP codes, hashed passwords, or PII without redaction.

### Validation

- **Runtime inputs** (HTTP body, GraphQL input, event payload): `class-validator` decorators on the DTO + global `ValidationPipe`.
- **Environment**: Zod schema in `apps/core/src/app/configuration.ts`.
- **Frontend forms**: Zod schemas via `@hookform/resolvers/zod`. Share with backend via `libs/shared/isomorphic` when possible.

### Error handling

- Throw NestJS HTTP exceptions for HTTP/GraphQL boundary errors: `NotFoundException`, `BadRequestException`, `UnauthorizedException`, `ForbiddenException`, `InternalServerErrorException`.
- Wrap external calls (third-party APIs, Stripe, etc.) in try/catch; log with structured context; rethrow as the appropriate Nest exception.
- Inside transactions, throw to roll back. Do not swallow.
- For event handlers: `REQUEUE` (Rabbit) or rely on SQS retries (AWS). Permanent failures should log with full context so the DLQ entry is actionable.

### Transactions

- Multi-write operations MUST run inside `db.transaction(async (tx) => { ... })`.
- Domain events are published INSIDE the transaction (publish-after-write, not publish-before-commit).
- Pessimistic locking: `.for('update')` when redeeming invitations, reserving inventory, etc.

### Module exports

- Module `exports: [<Context>Facade]` — Facade only.
- Library barrel `src/index.ts`: `export * from './lib/<context>.facade'` — Facade only.
- Internal services are providers but not exports.
- Exceptions (no-Facade pure-calc modules) must be justified.

---

## DO / DON'T

**DO**

- Read the project's `CONTEXT.md` before exploring or writing code. Use its vocabulary in every output (code, commits, issues, PR descriptions).
- Tag every new Nx project with `scope:* / type:* / target:*` at creation time (ADR-0015). An untagged project bypasses boundary enforcement.
- Mirror the file convention from ADR-0004 exactly when starting a new context.
- Publish a domain event from the originating transaction.
- Add a `.spec.ts` alongside every `.service.ts`.
- Use `@CurrentUser()`, `@Roles()`, `@Public()` rather than reading the request directly.
- Write the test first; make it pass; refactor.
- Reach for `db.transaction` whenever you write to more than one row.
- Use Drizzle's query builder; drop to `sql\`...\`` only when the builder fights you.
- Validate at boundaries: config (Zod), HTTP/GraphQL DTOs (class-validator), event payloads (class-validator on `DomainEvent<T>`), MCP and AI SDK tool parameters (Zod).
- For MCP tools: enforce per-call authz against `req.user` (verify the user has access to the requested resource scope).
- For the in-UI assistant: run in the user's session; tools receive the authenticated user and never escalate privileges.
- Log with structured context.
- Inject the Facade of another context, never the service.
- Share enums and isomorphic types via `libs/shared/isomorphic/models`.

**DON'T**

- Don't drift away from `CONTEXT.md` vocabulary. Use the canonical term; treat the "Avoid" list as prohibitions.
- Don't create a new Nx lib without tags. The boundary check is silently bypassed for untagged projects.
- Don't export internal services from a module. Use the Facade. No exceptions.
- Don't reach into another context's database tables — go through its Facade or subscribe to its events.
- Don't `console.log`. Use the per-class `Logger`.
- Don't publish raw objects to the event bus. Always construct a `DomainEvent` subclass.
- Don't add a context to `app.module.ts` without exporting its module from a lib.
- Don't write decorator-stuffed God services. Extract sub-services into the same module folder.
- Don't add new env vars without updating the Zod schema AND `.env.example`.
- Don't write MCP tools without per-call authz checks. Every tool that touches scoped resources MUST verify `actor` against the parameters.
- Don't suppress `forbidNonWhitelisted` globally just to make the assistant-ui chat work; override per-controller instead (ADR-0017).
- Don't return raw Drizzle row types from a service. Map them to DTOs at the service edge.
- Don't add an integration test that needs the API booted just to assert pure logic. Use `Test.createTestingModule` with mocks.

---

## Anti-patterns to avoid

- **God service.** A `<context>.service.ts` over ~800 lines is a smell. Split into sub-services (`cart.service.ts` inside `libs/core/order`, for example).
- **Stringly-typed events.** Publishing `{ type: 'something', data: {...} }` instead of a `DomainEvent` subclass defeats the validation guarantee. Always construct the class.
- **Cross-context table access.** A resolver in `libs/core/order` directly querying the `user` table couples the order module to auth's schema. Go through `AuthFacade`.
- **`@Public()` sprinkled liberally.** Every `@Public()` is a security review item. Justify each one.
- **Synchronous fan-out.** If a Facade method awaits five other Facades to do unrelated work, that work belongs on the event bus.
- **Duplicate validation logic.** A Zod schema on the frontend and a hand-written class-validator DTO on the backend that drift. Share via `libs/shared/isomorphic`.
- **Untracked schema changes.** A new column without a migration is broken on deploy. Always generate + commit the SQL.
- **Mocking what you don't own without integration coverage.** Mocking Drizzle's chain in a unit test is fine FOR LOGIC. Query correctness still needs a real Postgres.
- **Event publish outside the transaction.** Publishing after commit is the right outbox shape but is not what we do today. Publish inside the transaction, accept best-effort delivery, plan for outbox.

---

## Reference: ADRs

| # | Topic | Key decision |
|---|-------|--------------|
| [0001](./docs/adr/0001-nx-monorepo-layout.md) | Monorepo | Nx + pnpm + SWC + Webpack-HMR |
| [0002](./docs/adr/0002-bounded-contexts-as-libs-core.md) | DDD layout | One lib per bounded context |
| [0003](./docs/adr/0003-nestjs-modular-monolith.md) | Backend topology | One Nest process; Facade or event for cross-context |
| [0004](./docs/adr/0004-domain-module-file-convention.md) | File shape | 8 canonical files per context |
| [0005](./docs/adr/0005-facade-pattern-module-boundary.md) | Module boundary | Facade is the only export |
| [0006](./docs/adr/0006-drizzle-orm-with-postgres.md) | Persistence | Drizzle + pg + transactions + `DB_CONNECTION` |
| [0007](./docs/adr/0007-graphql-first-api.md) | API surface | GraphQL via Apollo, REST as escape hatch |
| [0008](./docs/adr/0008-domain-events-first-class.md) | Eventing | `DomainEvent<T>` + class-validator payloads |
| [0009](./docs/adr/0009-event-transport-variants.md) | Transport | RabbitMQ ↔ SNS/SQS, same event model |
| [0010](./docs/adr/0010-tdd-with-nestjs-test-utilities.md) | Testing | `Test.createTestingModule` + `useValue` mocks |
| [0011](./docs/adr/0011-config-via-zod-validated-env.md) | Config | Zod-validated env at boot |
| [0012](./docs/adr/0012-logging-nestjs-pino-per-class.md) | Logging | nestjs-pino + per-class Logger |
| [0013](./docs/adr/0013-session-based-auth-passport-otp.md) | Auth | Session + Passport + custom OTP |
| [0014](./docs/adr/0014-frontend-stack-plus-multi-frontend.md) | Frontend | Next + Apollo + Tailwind/Radix + Zustand + RHF/zod |
| [0015](./docs/adr/0015-nx-tag-based-boundary-enforcement.md) | Boundaries | Nx tags + `@nx/enforce-module-boundaries`: `scope:* / type:* / target:*` |
| [0016](./docs/adr/0016-mcp-tools-as-first-class-providers.md) | External AI | MCP tools as `@Injectable` `@Tool()` classes with Zod params + per-call user authz |
| [0017](./docs/adr/0017-assistant-ui-with-ai-sdk.md) | In-UI AI | assistant-ui + Vercel AI SDK v6 + `streamText` with inline `tool({...})` |
| [0018](./docs/adr/0018-ubiquitous-language-context-md.md) | DDD | `CONTEXT.md` glossary at repo root (or `CONTEXT-MAP.md` for multi-context) |
| [0019](./docs/adr/0019-supabase-managed-backbone.md) | Supabase variant | Supabase as managed backbone (overview) — orthogonal to API flavor |
| [0020](./docs/adr/0020-auth-via-supabase.md) | Auth (Supabase) | Supabase Auth + JWT verification replaces session+Passport+OTP |
| [0021](./docs/adr/0021-realtime-via-supabase-broadcast.md) | Realtime (Supabase) | Broadcast for live-to-browser fan-out; NOT the backend event bus |
| [0022](./docs/adr/0022-storage-via-supabase-storage.md) | Storage (Supabase) | Buckets + RLS + signed URLs; direct browser uploads by default |
| [0023](./docs/adr/0023-jobs-via-pgmq-pg-cron.md) | Jobs (Supabase) | pgmq for queues, pg_cron for SQL schedules; replaces BullMQ + Redis |
