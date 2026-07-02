import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '@labda/core-common';
import type { AuthenticatedUser } from '@labda/core-common';
import { AnalysisService } from './analysis.service';
import {
  Analysis,
  AnalysisExport,
  RunAnalysisInput,
} from './analysis.models';

@Resolver(() => Analysis)
export class AnalysisResolver {
  constructor(private readonly analysisService: AnalysisService) {}

  @Query(() => [Analysis], { name: 'analyses' })
  async analyses(
    @CurrentUser() user: AuthenticatedUser,
    @Args('protocolId', { type: () => ID }) protocolId: string,
  ): Promise<Analysis[]> {
    return this.analysisService.listAnalyses(user, protocolId);
  }

  @Query(() => Analysis, { name: 'analysis' })
  async analysis(
    @CurrentUser() user: AuthenticatedUser,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Analysis> {
    return this.analysisService.getAnalysis(user, id);
  }

  @Mutation(() => Analysis)
  async runAnalysis(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: RunAnalysisInput,
  ): Promise<Analysis> {
    return this.analysisService.runAnalysis(user, input);
  }

  @Mutation(() => AnalysisExport)
  async exportAnalysis(
    @CurrentUser() user: AuthenticatedUser,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<AnalysisExport> {
    return this.analysisService.exportAnalysis(user, id);
  }
}
