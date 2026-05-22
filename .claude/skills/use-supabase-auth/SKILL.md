---
name: use-supabase-auth
description: Use when the user asks to "wire Supabase Auth", "switch auth to Supabase", "add OAuth via Supabase", "set up magic link / email OTP with Supabase", or "make the Nest backend verify Supabase JWTs". Replaces the session + Passport + custom OTP path with Supabase Auth + JWT verification while keeping the rest of the auth model (@CurrentUser, @Roles, multi-tenant checks).
---

# use-supabase-auth

Switch the project's auth from session+Passport+OTP to Supabase Auth. The backend verifies Supabase JWTs; the frontend uses `@supabase/ssr` for cookie-aware sessions. `@CurrentUser()`, `@Roles()`, `@Public()`, and multi-tenant scope checks all keep working — only the identity-proof and session mechanism change.

## When to use

- Starting a new Supabase-variant project.
- Migrating an existing project from custom OTP to Supabase Auth.
- Adding OAuth providers and don't want to maintain Passport strategies for each.

## Inputs to confirm

1. **Supabase project URL + keys** — anon key (frontend), service-role key (backend), JWT secret (verification).
2. **Auth providers** — OAuth (Google/GitHub/Apple), magic link, email OTP, email+password.
3. **JWT verification mode** — local HS256 (fast, honors revocations only on expiry) or remote `supabase.auth.getUser(token)` (fully fresh, +1 round-trip per request).
4. **Existing membership table** — typically `workspace_member` keyed on `auth.users.id`.

## Steps

### 1. Install dependencies

```bash
pnpm add @supabase/supabase-js @supabase/ssr
```

### 2. Configure env

`apps/<api>/src/app/configuration.ts`:

```ts
supabase: z.object({
  url: z.string(),
  anonKey: z.string(),
  serviceRoleKey: z.string(),
  jwtSecret: z.string(),
}),
```

`.env.example`:

```
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<from `supabase status`>
SUPABASE_SERVICE_ROLE_KEY=<from `supabase status`>
SUPABASE_JWT_SECRET=<from `supabase status`>
```

### 3. Backend: `SupabaseJwtStrategy`

`libs/core/auth/src/lib/strategies/supabase-jwt.strategy.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import { DB_CONNECTION } from '../db/tokens';
import * as schema from '../db/schema';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';

function extractBearerToken(request: Request): string | null {
  const auth = request.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

@Injectable()
export class SupabaseJwtStrategy {
  private readonly supabase: SupabaseClient;

  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
    private readonly configService: ConfigService,
  ) {
    this.supabase = createClient(
      configService.getOrThrow('supabase.url'),
      configService.getOrThrow('supabase.serviceRoleKey'),
      { auth: { persistSession: false } },
    );
  }

  async authenticate(request: Request): Promise<AuthenticatedUser | null> {
    const token = extractBearerToken(request);
    if (!token) return null;

    // Default: remote validation (handles revocations).
    // Faster alternative: jwt.verify(token, supabase.jwtSecret) locally.
    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user) return null;

    // Look up the user's role/scope in OUR membership table.
    const [member] = await this.db
      .select()
      .from(schema.workspaceMember)
      .where(eq(schema.workspaceMember.userId, data.user.id))
      .limit(1);

    return {
      userId: data.user.id,
      email: data.user.email ?? undefined,
      role: member?.role,
      workspaceId: member?.workspaceId,
      // ...other fields your AuthenticatedUser DTO needs
    };
  }
}
```

### 4. Backend: `MainAuthGuard`

Replace the existing global guard with one that calls `SupabaseJwtStrategy.authenticate`:

```ts
@Injectable()
export class MainAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabaseJwtStrategy: SupabaseJwtStrategy,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user = await this.supabaseJwtStrategy.authenticate(request);
    if (!user) throw new UnauthorizedException();

    (request as Request & { user: AuthenticatedUser }).user = user;
    return true;
  }
}
```

Register as `APP_GUARD` in the AuthModule (replaces the existing global guard registration).

### 5. Backend: remove unused pieces

- Drop `express-session`, `connect-redis`, `passport`, `passport-custom`, and the OTP-related files (`otp.guard.ts`, `otp.strategy.ts`, `auth.serializer.ts`).
- Drop `getSessionMiddleware` and the session cookie handling in `apps/<api>/src/main.ts`.
- If you had subscription auth via `decorateGQLSubscriptionRequest`, replace it with a JWT-verifying onConnect that calls the same strategy.

### 6. Frontend: install + middleware

```bash
pnpm add @supabase/ssr @supabase/supabase-js
```

`apps/<ui>/src/lib/supabase.ts`:

```ts
import { createBrowserClient, createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const browserClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

export const serverClient = () => {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options: CookieOptions) => cookieStore.set({ name, value, ...options }),
        remove: (name, options: CookieOptions) => cookieStore.set({ name, value: '', ...options }),
      },
    },
  );
};
```

`apps/<ui>/src/middleware.ts` (refreshes the session on each navigation):

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => request.cookies.get(name)?.value,
        set: (name, value, options) => {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request });
          response.cookies.set({ name, value, ...options });
        },
        remove: (name, options) => {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    },
  );

  await supabase.auth.getUser();
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
```

### 7. Frontend: sign-in UI + callback

- **OAuth:** `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '${origin}/auth/callback' } })`.
- **Magic link / OTP:** `supabase.auth.signInWithOtp({ email })`.

`apps/<ui>/src/app/auth/callback/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  if (code) {
    const supabase = serverClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(`${origin}/`);
}
```

### 8. API calls attach the JWT

For each backend call, attach `Authorization: Bearer <session.access_token>`:

```ts
const { data: { session } } = await supabase.auth.getSession();
const headers = new Headers();
if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
fetch('/api/...', { headers });
```

For Apollo Client (GraphQL flavor), use an `authLink` that reads the session.

### 9. RLS

Write RLS policies for every table the browser anon client touches (Realtime, Storage, direct DB reads). Default-deny.

## Rules

- **DO** keep the rest of the auth model: global guard, `@Public()`, `@Roles()`, `@CurrentUser()`, multi-tenant scope checks.
- **DO** look up role/membership in the project's own tables. Supabase only provides identity; authorization is yours.
- **DO** verify the JWT before touching the DB. Reject early.
- **DO** write RLS policies for every table the browser can reach.
- **DON'T** keep `express-session` + Passport-OTP in parallel. Pick one. Mixing them creates two sources of truth for "who's logged in".
- **DON'T** introduce an `Actor` abstraction or workbook-scoped API keys. AI agents authenticate via OAuth like any other integration (ADR-0016).

## References

- ADR-0013: Session-based auth (what this varies)
- ADR-0020: Auth via Supabase
- ADR-0019: Supabase as managed infrastructure backbone
