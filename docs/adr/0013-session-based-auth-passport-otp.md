# ADR-0013: Session-based auth with Passport + custom OTP

## TL;DR

`express-session` + `connect-redis` for sessions; Passport custom strategy for email OTP. `MainAuthGuard` is global (`APP_GUARD`); `@Public()` opts out. `@Roles()` enforces RBAC; `@CurrentUser()` injects the user. GraphQL subscriptions inherit identity via `decorateGQLSubscriptionRequest`. External integrations (and future external AI agents) authenticate via OAuth-style flows alongside this, not via parallel identity models.

**Status:** Accepted
**Date:** 2026-05-11

## Context

We need first-party authentication without re-inventing token lifecycle, refresh dances, or bespoke crypto. The frontends and backend share a domain and a deploy boundary, so cookie-based sessions are simpler and safer than JWT bearer tokens. Email OTP is the chosen identity proof: it is passwordless, cheap to operate, and resilient to credential reuse.

The auth layer must also support:

- GraphQL subscriptions over websockets (auth must survive the upgrade).
- Public endpoints (OAuth callbacks, invitation redemption) that opt out of auth.
- Role-based authorization at resolver granularity.
- Future identity providers (SSO, magic links) without a rewrite.

## Decision

**Session layer:** `express-session` with `connect-redis` store.

- Session middleware lives in `apps/core/src/app/session.helper.ts` as `getSessionMiddleware`.
- Redis store uses `prefix: 'core-session:'`.
- Cookie options come from `ConfigService`: `secure`, `domain`, `maxAge`, `sameSite`, `name`.
- `saveUninitialized: false`, `resave: false`.

**Auth strategy:** Passport with `passport-custom` (no native library), implementing OTP. Located in `libs/core/auth`:

- `OtpStrategy` — the custom Passport strategy.
- `OtpAuthGuard` — guard that runs the strategy.
- `MainAuthGuard` — the global guard, registered as `APP_GUARD` in `AuthModule`. Every endpoint is protected by default.
- `AuthSerializer` — `serializeUser`/`deserializeUser` for session round-trip.

**Auth flow (email OTP):**

1. `sendEmailOtp(email)` — in `AuthService`. Inside a transaction:
   - Find the user by email.
   - Invalidate any older non-verified OTPs for this identifier.
   - Insert a new OTP row (6-digit code, 10-minute expiry, `attemptCount: 0`).
   - Emit a PostHog `USER_LOGIN_ATTEMPT` analytics event.
2. `verifyEmailOtp(email, code)` — also transactional:
   - Find the latest non-verified, non-expired OTP for this identifier.
   - Increment attempt count; reject if `> 3`.
   - Reject if code mismatches.
   - Mark OTP `isVerified: true`.
   - If the user was not yet email-verified, mark them verified and publish `AuthUserCreatedEvent`.
   - Return the `AuthenticatedUser`.

**Authorization decorators (in `libs/core/common/src/lib/decorators/`):**

- `@Public()` — bypass the global auth guard. Used on OAuth callbacks, public mutations (`redeemInvite`, `getInvite`), and queue handlers (queue handlers always declare `@Public()`).
- `@Roles(UserRole.WORKSPACE_ADMIN, UserRole.ADMIN, ...)` — require at least one of the listed roles.
- `@CurrentUser()` — parameter decorator that injects the authenticated user.
- `@SessionId()` — inject the session ID directly.
- `@MarketingSessionId()` — inject the marketing tracking ID (cookie-based, not auth-session).

**GraphQL subscription auth:**

`graphql-ws` `onConnect` calls `decorateGQLSubscriptionRequest(redisClient, configService, request)` (in `session.helper.ts`), which:

1. Builds a synthetic Express request from the ws upgrade.
2. Runs `getSessionMiddleware` to populate `request.session`.
3. Runs `passport.session()` to populate `request.user`.
4. Returns `{ user }` to the Apollo subscription context.

This ensures subscriptions share the same identity as queries/mutations, with no separate websocket token mechanism.

**Marketing session ID:**

Independent of auth. `getOrCreateMarketingSessionId` (in `session.helper.ts`) reads/sets a separate cookie (`core.marketingsid`) carrying a UUID for analytics fan-out. The cookie is `httpOnly: false`, `sameSite` and `secure` mirroring the auth session.

## Consequences

**Accept:**

- Single source of identity — the session cookie. CSRF mitigated by `sameSite=strict` (or `lax`) plus `secure` in prod.
- Server-side session invalidation works (Redis-backed) — logging out anywhere invalidates everywhere.
- Adding a new identity proof (Google SSO, magic link, WebAuthn) is a new Passport strategy plus a resolver mutation, not a rewrite.
- `@Public()`/`@Roles()`/`@CurrentUser()` keep resolver code clean of auth plumbing.
- Subscriptions inherit identity for free.

**Live with:**

- Stateful auth requires Redis availability. Degraded Redis equals degraded auth; health indicators (`redis.indicator.ts`) surface this.
- The global `MainAuthGuard` means every new endpoint is auth-required by default — a forgotten `@Public()` is a sharp edge, but defaults-secure is the right policy.
- Multi-tenant isolation (workspace-scoped data) is NOT enforced by guards alone. Every resolver that touches workspace data must check `user.primaryWorkspaceId === resource.workspaceId` (or equivalent). The `currentWorkspaceId` in the GraphQL context is a convenience, not a security guarantee.
- OTP codes in dev logs (see ADR-0012) MUST be removed before prod.
- Rate limiting on OTP requests is not yet in place (`attemptCount: 0` is per-OTP, not per-identifier per-time-window). Add throttling at the resolver before prod traffic.
