import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { CurrentUser } from '@labda/core-common';
import type { AuthenticatedUser } from '@labda/core-common';
import { ResearchService } from './research.service';
import {
  AddHypothesisInput,
  CreateProjectInput,
  Hypothesis,
  Project,
} from './research.models';

@Resolver(() => Project)
export class ResearchResolver {
  constructor(private readonly researchService: ResearchService) {}

  @Query(() => [Project], { name: 'myProjects' })
  async myProjects(@CurrentUser() user: AuthenticatedUser): Promise<Project[]> {
    return this.researchService.listProjects(user);
  }

  @Query(() => Project, { name: 'project' })
  async project(
    @CurrentUser() user: AuthenticatedUser,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Project> {
    return this.researchService.getProject(user, id);
  }

  @Mutation(() => Project)
  async createProject(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: CreateProjectInput,
  ): Promise<Project> {
    return this.researchService.createProject(user, input);
  }

  @Mutation(() => Hypothesis)
  async addHypothesis(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: AddHypothesisInput,
  ): Promise<Hypothesis> {
    return this.researchService.addHypothesis(user, input);
  }

  @ResolveField(() => [Hypothesis])
  async hypotheses(
    @CurrentUser() user: AuthenticatedUser,
    @Parent() parent: Project,
  ): Promise<Hypothesis[]> {
    return this.researchService.listHypotheses(user, parent.id);
  }
}
