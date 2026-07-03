import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '@labda/core-common';
import type { AuthenticatedUser } from '@labda/core-common';
import { SessionService } from './session.service';
import {
  AgentSession,
  CreateAgentSessionInput,
  SaveAgentSessionInput,
} from './session.models';

@Resolver(() => AgentSession)
export class SessionResolver {
  constructor(private readonly sessionService: SessionService) {}

  @Query(() => [AgentSession], { name: 'sessions' })
  async sessions(
    @CurrentUser() user: AuthenticatedUser,
    @Args('projectId', { type: () => ID }) projectId: string,
  ): Promise<AgentSession[]> {
    return this.sessionService.listSessions(user, projectId);
  }

  @Mutation(() => AgentSession)
  async createAgentSession(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: CreateAgentSessionInput,
  ): Promise<AgentSession> {
    return this.sessionService.createSession(user, input);
  }

  @Mutation(() => Boolean)
  async saveAgentSession(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: SaveAgentSessionInput,
  ): Promise<boolean> {
    return this.sessionService.saveSession(user, input);
  }

  @Mutation(() => Boolean)
  async deleteAgentSession(
    @CurrentUser() user: AuthenticatedUser,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.sessionService.deleteSession(user, id);
  }
}
