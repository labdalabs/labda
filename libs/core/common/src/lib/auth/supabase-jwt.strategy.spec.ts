import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { SupabaseJwtStrategy } from './supabase-jwt.strategy';

describe('SupabaseJwtStrategy', () => {
  function makeStrategy(jwtSecret = 'a-jwt-secret-that-is-long-enough-32') {
    return new SupabaseJwtStrategy({
      get: (key: string) => (key === 'supabase.jwtSecret' ? jwtSecret : undefined),
    } as unknown as ConfigService);
  }

  it('maps a Supabase JWT payload to AuthenticatedUser', () => {
    const strategy = makeStrategy();
    const user = strategy.validate({
      sub: 'user-1',
      email: 'a@example.com',
      role: 'admin',
    });
    expect(user).toEqual({ id: 'user-1', email: 'a@example.com', role: 'admin' });
  });

  it('defaults role to "authenticated" when missing', () => {
    const strategy = makeStrategy();
    const user = strategy.validate({ sub: 'user-1' });
    expect(user.role).toBe('authenticated');
  });

  it('throws UnauthorizedException when sub is missing', () => {
    const strategy = makeStrategy();
    expect(() => strategy.validate({} as never)).toThrow(UnauthorizedException);
  });
});
