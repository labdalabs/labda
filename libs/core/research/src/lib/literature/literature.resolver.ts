import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '@labda/core-common';
import type { AuthenticatedUser } from '@labda/core-common';
import { LiteratureService } from './literature.service';
import {
  AttachReferenceInput,
  LiteratureResult,
  Reference,
  SearchLiteratureInput,
} from './literature.models';

@Resolver(() => Reference)
export class LiteratureResolver {
  constructor(private readonly literatureService: LiteratureService) {}

  @Query(() => [LiteratureResult], { name: 'searchLiterature' })
  async searchLiterature(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: SearchLiteratureInput,
  ): Promise<LiteratureResult[]> {
    return this.literatureService.searchLiterature(user, input);
  }

  @Query(() => [LiteratureResult], { name: 'newPapers' })
  async newPapers(
    @CurrentUser() user: AuthenticatedUser,
    @Args('projectId', { type: () => ID }) projectId: string,
    @Args('sinceYear', { type: () => Int, nullable: true, defaultValue: 0 })
    sinceYear: number,
  ): Promise<LiteratureResult[]> {
    return this.literatureService.newPapers(user, projectId, sinceYear);
  }

  @Query(() => [Reference], { name: 'references' })
  async references(
    @CurrentUser() user: AuthenticatedUser,
    @Args('hypothesisId', { type: () => ID }) hypothesisId: string,
  ): Promise<Reference[]> {
    return this.literatureService.listReferences(user, hypothesisId);
  }

  @Mutation(() => Reference)
  async attachReference(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: AttachReferenceInput,
  ): Promise<Reference> {
    return this.literatureService.attachReference(user, input);
  }
}
