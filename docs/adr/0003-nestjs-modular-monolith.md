# ADR-0003: NestJS modular monolith

## TL;DR

One NestJS process per deployable. The root `AppModule` imports every bounded-context module. Cross-context communication has exactly two modes: synchronous (Facade injection) or asynchronous (domain event). Future extraction to microservices is mechanical because Facade and event interfaces are the eventual RPC contract.

**Status:** Accepted
**Date:** 2026-05-11

## Context

A microservices-first split forces operational overhead (multiple deployables, service discovery, inter-service auth, mesh, distributed tracing) and slows iteration in the early stages of a product. At the other extreme, a single-process "do everything" service without internal structure entangles bounded contexts.

We want context isolation in the code, with operational simplicity. We also want async work, GraphQL, REST, scheduled jobs, and queue handling within one runtime.

NestJS provides the right primitives: modules as dependency-injection scopes, decorators for HTTP/GraphQL/microservices, lifecycle hooks for graceful shutdown, and a mature ecosystem (`@nestjs/apollo`, `@nestjs/bullmq`, `@nestjs/cache-manager`, `@nestjs/passport`, `@nestjs/schedule`, `@nestjs/terminus`).

## Decision

`apps/core` is a single NestJS process per deployable. Its root `AppModule` imports:

- Global infrastructure: `CommonModule` (DB, Redis, EventBus, Analytics, Jobs, Health), `LoggerModule` (pino), `GraphQLModule` (Apollo), `ConfigModule`, `CacheModule`, `PassportModule`, `ScheduleModule`, `McpModule` (when MCP is in scope).
- Each bounded-context module: `AuthModule`, `WorkspaceModule`, `OrderModule`, etc.

Cross-context communication has exactly two modes:

1. **Synchronous:** injecting another context's Facade. Used when the caller needs an answer in the current request. See ADR-0005.
2. **Asynchronous:** publishing a domain event. Used when the work is decoupled from the request. See ADR-0008.

The deployable is one process, one container image, one set of environment variables, one log stream. When a context's load profile justifies it (CPU bound, sustained throughput, very different scale curve), it can later be extracted by:

- Moving its Facade behind a network transport (gRPC, HTTP, message-based RPC).
- Moving its consumer to a separate runtime that subscribes to the same event topics.

The Facade and event interfaces are deliberately the eventual RPC contract.

## Consequences

**Accept:**

- Single deploy, single observability surface, single shared auth context.
- Refactors across contexts are normal compiler-checked operations — rename a Facade method, get type errors at every call site, fix in one PR.
- The mode of communication (sync vs async) is documented in the code: Facade injection vs `eventBusService.publish`. Reviewers can challenge a sync call that ought to be async (or vice versa).
- One process per env keeps onboarding cheap: `pnpm nx serve-hmr core` and you have everything.

**Live with:**

- Risk of accidental coupling if Facade discipline lapses (ADR-0005 enforces it but is unenforced by tooling).
- Single-process resource limits eventually bite: GraphQL workers, queue consumers, scheduled jobs, and HTTP all share the same Node event loop. Vertical scale is fine until it is not; horizontal scale of the monolith is also fine until queue-handler concurrency interferes with HTTP latency. The hand-off to per-context processes is a future decision, not a current cost.
- Mixed transports in one process (HTTP + websocket + Rabbit/SQS consumers + scheduler) make local reproduction of production issues harder. Compensated by structured logging (ADR-0012) and health indicators (`libs/core/common/src/lib/health`).
