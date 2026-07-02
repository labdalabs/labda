import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '@labda/core-common';
import type { AuthenticatedUser } from '@labda/core-common';
import { ProtocolService } from './protocol.service';
import {
  CreateProtocolInput,
  Protocol,
  SaveProtocolInput,
} from './protocol.models';

@Resolver(() => Protocol)
export class ProtocolResolver {
  constructor(private readonly protocolService: ProtocolService) {}

  @Query(() => Protocol, { name: 'protocol' })
  async protocol(
    @CurrentUser() user: AuthenticatedUser,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Protocol> {
    return this.protocolService.getProtocol(user, id);
  }

  @Query(() => [Protocol], { name: 'protocols' })
  async protocols(
    @CurrentUser() user: AuthenticatedUser,
    @Args('projectId', { type: () => ID }) projectId: string,
  ): Promise<Protocol[]> {
    return this.protocolService.listProtocols(user, projectId);
  }

  @Mutation(() => Protocol)
  async createProtocol(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: CreateProtocolInput,
  ): Promise<Protocol> {
    return this.protocolService.createProtocol(user, input);
  }

  @Mutation(() => Protocol)
  async saveProtocol(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: SaveProtocolInput,
  ): Promise<Protocol> {
    return this.protocolService.saveProtocol(user, input);
  }
}
