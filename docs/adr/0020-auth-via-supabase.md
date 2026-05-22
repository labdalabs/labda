# ADR-0020: Auth via Supabase

## TL;DR

Use Supabase Auth for identity (OAuth providers, magic link, email OTP) and JWT issuance. The Nest backend verifies the Supabase JWT in a `SupabaseJwtStrategy` and resolves the user (plus their role in the project's own `workspace_member` table) into `@CurrentUser()`. The decorators, guard, RBAC model, and resolver patterns from ADR-0013 are unchanged — only the identity-proof and session mechanism flips from express-session + Passport-custom to Supabase JWT verification. The frontend uses `@supabase/ssr` to manage session cookies.

**Status:** Accepted
**Date:** 2026-05-11
**Applies to:** projects on the Supabase variant (ADR-0019). Supersedes the session-and-OTP parts of ADR-0013 for these projects.

## Context

ADR-0013 ships a working but bespoke auth stack: `express-session` + `connect-redis`, Passport custom strategy, hand-rolled email OTP. It's solid but it's also code that has to be maintained, scaled, and audited. Supabase Auth provides:

- OAuth providers (Google, GitHub, Apple, ...) out of the box.
- Email OTP and magic-link flows with templated emails.
- JWT issuance with refresh tokens.
- Server-side and SSR helpers (`@supabase/ssr`) that handle the Next.js cookie dance.
- An admin API for backend-side user provisioning.

We want the Supabase auth primitives without losing the rest of our auth model — global guard, `@Public()` opt-out, `@Roles()` RBAC, `@CurrentUser()` injection, multi-tenant scope checks. Supabase issues JWTs; we verify them; we layer our own role/membership lookups on top.

## Decision

### Server side (Nest)

- **`SupabaseJwtStrategy`** lives in `libs/core/auth/src/lib/strategies/supabase-jwt.strategy.ts`. It:
  - Extracts the Bearer token from `Authorization`.
  - Either verifies the JWT locally using the Supabase JWT secret (HS256), or calls `supabase.auth.getUser(token)` for full validation including revocation. **Default to local verification** for performance; switch to `getUser()` when you need to honor revocations promptly.
  - Looks up the user's role in the project's own `workspace_member` table.
  - Returns an `AuthenticatedUser` (`{ userId, email, role, workspaceId, ... }`) — the same DTO the rest of the code already expects.

- **`MainAuthGuard`** is the global `APP_GUARD` (unchanged from ADR-0013). It calls the strategy and attaches the user to `req.user`.

- **`@Public()`** opts out (unchanged).
- **`@Roles(UserRole.X)`** enforces RBAC at the resolver/controller (unchanged).
- **`@CurrentUser()`** injects the user (unchanged).
- **Multi-tenant scope checks** in resolvers and services remain the contributor's responsibility (unchanged from ADR-0013's caveats).

The auth module also exposes a small admin helper (`SupabaseAdminClient`) that wraps the service-role client. Used for backend-initiated user provisioning, invitation flows, and email triggering.

Config additions in `apps/<api>/src/app/configuration.ts`:

```ts
supabase: z.object({
  url: z.string(),
  anonKey: z.string(),
  serviceRoleKey: z.string(),
  jwtSecret: z.string(),
}),
```

Pulled from `supabase status` locally; from Supabase project settings in deployed envs.

### Client side (Next.js)

- **`@supabase/ssr`** for the cookie-aware session helpers. Two clients:
  - **Browser client** (`createBrowserClient`) for client components.
  - **Server client** (`createServerClient`) for server components, route handlers, and middleware.

- **Session middleware** at `apps/<ui>/src/middleware.ts` refreshes the session on each navigation.

- **Sign-in routes**:
  - `/login` — UI that calls `supabase.auth.signInWithOAuth({ provider })` or `signInWithOtp({ email })`.
  - `/auth/callback` — receives the OAuth redirect, exchanges code for session, redirects to the app.

- **API calls to the Nest backend** attach the user's JWT as `Authorization: Bearer <session.access_token>`. The custom `fetch` (e.g., in the chat sidebar — ADR-0017) does this; for Apollo Client (GraphQL flavor), use the auth link.

### Sign-out

- Frontend: `supabase.auth.signOut()` clears the session cookies.
- Backend: the next request lacks a valid JWT; the guard rejects it.
- Server-side invalidation: use `supabase.auth.admin.signOut(userId)` from the service-role client to invalidate refresh tokens for a specific user. The active JWT is still valid until expiry (typically 1h); for hard-invalidation, switch the strategy to `supabase.auth.getUser(token)` mode.

### RLS

Supabase RLS policies are written alongside the Drizzle schema, as separate `supabase/migrations/*.sql` files produced by `supabase db diff`. RLS enforces row-level access at the database. For the Nest backend (using the service-role key), RLS is bypassed — Nest is the authoritative authz layer. For the browser anon client (used for direct realtime / storage access), RLS is the only thing standing between users and other users' data. Write RLS policies for every table that the browser anon client can reach.

## Consequences

**Accept:**

- OAuth providers are a config change, not a code change.
- No password storage, no OTP rate-limiting, no email template plumbing on our side.
- Cookie + session management on the frontend is solved by `@supabase/ssr`.
- The user identity model on the backend is unchanged — `@CurrentUser`, `@Roles`, multi-tenant checks all still apply.

**Live with:**

- **JWT verification trade-off.** Local HS256 verification is fast but stale revocations are honored only on JWT expiry. Remote `getUser()` is fully fresh but adds a network round-trip per request. Pick one and document.
- **Two authz layers.** Nest decorators + RLS policies must agree. Write the RLS test cases.
- **Membership / role still lives in our DB.** Supabase only provides the identity (who); we provide the authorization context (what they can do, where). The strategy's DB round-trip per request is the cost. Cache aggressively if it becomes a hot path.
- **The `auth.users` table is Supabase-managed.** Our app tables foreign-key to `auth.users.id` (UUID). Schema migrations on `auth.*` are off-limits.
- **OAuth scopes are Supabase-managed too.** Adding a provider requires Supabase dashboard config — not just code.

## References

- ADR-0013: Session-based auth (what this varies)
- ADR-0019: Supabase as managed infrastructure backbone
- `use-supabase-auth` skill in `.claude/skills/` (the recipe)
