import { CanActivate, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/supabase-jwt.strategy';
import { createTestUser, TestUserPayload } from './test-jwt';

// Drop-in replacement for MainAuthGuard. Pass `null` to simulate an
// unauthenticated request, or a partial user to override defaults.
//
//   await Test.createTestingModule({ imports: [AppModule] })
//     .overrideGuard(MainAuthGuard)
//     .useValue(createTestAuthGuard(createTestUser({ role: 'admin' })))
//     .compile();
export function createTestAuthGuard(
  user: TestUserPayload | null = createTestUser(),
): CanActivate {
  return {
    canActivate(context: ExecutionContext): boolean {
      if (user === null) return false;
      const request = context.switchToHttp().getRequest();
      request.user = {
        id: user.id,
        email: user.email,
        role: user.role,
      } satisfies AuthenticatedUser;
      return true;
    },
  };
}
