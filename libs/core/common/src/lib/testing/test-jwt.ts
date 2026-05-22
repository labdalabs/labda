import { sign } from 'jsonwebtoken';

// Default test JWT secret — matches the value Supabase ships locally
// (see `supabase/config.toml`). For real cloud projects, pull from
// `pnpm supabase status` or the dashboard.
export const TEST_JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long';

export interface TestUserPayload {
  id: string;
  email: string;
  role: string;
}

export function createTestUser(overrides: Partial<TestUserPayload> = {}): TestUserPayload {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'test@example.com',
    role: 'authenticated',
    ...overrides,
  };
}

// Sign a Supabase-shaped access token usable against SupabaseJwtStrategy in
// tests. Use the secret from your test environment (defaults to the local
// Supabase secret) so the strategy's verification succeeds.
//
//   const token = signTestJwt(createTestUser({ role: 'admin' }));
//   await request(app.getHttpServer())
//     .get('/me')
//     .set('Authorization', `Bearer ${token}`)
//     .expect(200);
export function signTestJwt(
  user: TestUserPayload = createTestUser(),
  secret: string = TEST_JWT_SECRET,
): string {
  return sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      aud: 'authenticated',
    },
    secret,
    { algorithm: 'HS256', expiresIn: '1h' },
  );
}
