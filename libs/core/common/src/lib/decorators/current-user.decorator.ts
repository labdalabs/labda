import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { AuthenticatedUser } from '../auth/supabase-jwt.strategy';

// Works for both HTTP (REST/MCP) and GraphQL resolvers: reads `request.user`
// set by the Supabase JWT strategy, resolving the request out of whichever
// execution context is active.
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | undefined => {
    if (context.getType<'graphql' | 'http'>() === 'graphql') {
      const gqlCtx = GqlExecutionContext.create(context);
      return gqlCtx.getContext().req?.user;
    }
    return context.switchToHttp().getRequest().user;
  },
);
