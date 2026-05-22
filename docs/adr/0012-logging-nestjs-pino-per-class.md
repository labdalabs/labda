# ADR-0012: Logging via nestjs-pino with per-class Logger

## TL;DR

`nestjs-pino` with `genReqId` propagating the request ID into `X-Request-Id`. Each class declares `private readonly logger = new Logger(<Class>.name)`. Log structured context as object payloads (`{ userId, error }`), never bare-string interpolation. `pino-pretty` only in dev. `console.log` is banned.

**Status:** Accepted
**Date:** 2026-05-11

## Context

A high-throughput backend needs structured, fast logging. `console.log` is unacceptable in production: it is slow, unstructured, and loses context. Request IDs must propagate across log lines for distributed tracing. Health-check noise must be suppressed so that real signals are visible.

Requirements:

- JSON in production for ingestion (Loki, Datadog, CloudWatch).
- Human-readable in development for fast feedback.
- Per-request request IDs threaded through every log line of that request.
- Per-class loggers so log lines self-identify their source.
- Structured context (object payloads) rather than string concatenation.

`nestjs-pino` wraps `pino` and integrates with Nest's `Logger` interface. It is fast, supports request-scoped loggers via `pinoHttp`, and ships with `pino-pretty` for dev.

## Decision

**Wiring (`apps/core/src/app/app.module.ts`):**

```ts
LoggerModule.forRootAsync({
  useFactory: (configService) => ({
    pinoHttp: {
      level: configService.get('logLevel'),
      transport: configService.get('logPretty')
        ? { target: 'pino-pretty' }
        : undefined,
      genReqId: (req, res) => {
        const id = (req.id as string) ?? req.headers['x-request-id'] ?? randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
    },
    exclude: [{ method: RequestMethod.ALL, path: 'health' }],
  }),
  inject: [ConfigService],
})
```

**Bootstrap (`apps/core/src/main.ts`):**

```ts
const app = await NestFactory.create<NestExpressApplication>(AppModule, {
  bufferLogs: true,
  rawBody: true,
});
const logger = app.get(Logger);
app.useLogger(logger);
```

`bufferLogs: true` ensures startup logs are not lost while the logger is being constructed.

**Per-class logger:**

Each class declares its own `Logger`:

```ts
private readonly logger = new Logger(WorkspaceService.name);
```

The class name is the log source. Reviewers should reject `private readonly logger = new Logger('SomeArbitraryString')` — use `.name`.

**Logging style:**

- Structured context first: `this.logger.error('Failed to send OTP', { email, error })`.
- Avoid string concatenation: not `` `Failed for ${email}` ``, but `` 'Failed' + { email } `` or `` 'Failed for OTP' `` with structured context.
- Debug logs are encouraged on happy paths. Production sets `logLevel=info`; dev sets `logLevel=debug`.
- The error object goes in the context, not the message: `{ error }`. Pino serializes it correctly.
- Never log secrets, tokens, hashed passwords, or OTP codes. If a dev-only verbose log emits one for debugging, gate it on a config flag and audit before any production deploy.

**`console.log` is banned.** Replace with `this.logger.debug` or `.log`.

## Consequences

**Accept:**

- Logs are JSON in prod (pino-fast), human-readable in dev (pino-pretty).
- Every log line carries the request ID via `pinoHttp`'s context. Cross-service traces stitch via `X-Request-Id` (returned in the response header).
- Log search is structured: jq, Loki, Datadog, CloudWatch all index by field.
- Health checks don't pollute the request log.

**Live with:**

- Bare-string log calls slip through review when there is no enforced linter rule. Consider adding a `no-console` ESLint rule and a custom rule that flags loggers without structured context.
- `pino-pretty` is dev only — running it in prod is a performance footgun.
- `nestjs-pino` request-scoped loggers (`PinoLogger`) exist as an alternative to `Logger`. The codebase uses the simpler `new Logger(<Name>.name)` pattern consistently; do not mix the two within the same project unless the request-scoped variant solves a specific need.
- Any dev-time exposure of secrets in logs MUST be removed before any production deploy. Treat secret-in-log as a security review item.
