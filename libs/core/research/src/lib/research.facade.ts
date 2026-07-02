import { Injectable, Logger } from '@nestjs/common';
import type { AuthenticatedUser } from '@labda/core-common';
import { ResearchService } from './research.service';
import type {
  AddHypothesisInput,
  CreateProjectInput,
  HypothesisDto,
  ProjectDto,
} from './research.models';

// Public service-to-service surface of the research context (ADR-0005).
// Other contexts (literature, protocol, agent) call this — never the service.
@Injectable()
export class ResearchFacade {
  private readonly logger = new Logger(ResearchFacade.name);

  constructor(private readonly researchService: ResearchService) {}

  createProject(
    user: AuthenticatedUser,
    input: CreateProjectInput,
  ): Promise<ProjectDto> {
    return this.researchService.createProject(user, input);
  }

  listProjects(user: AuthenticatedUser): Promise<ProjectDto[]> {
    return this.researchService.listProjects(user);
  }

  getProject(user: AuthenticatedUser, id: string): Promise<ProjectDto> {
    return this.researchService.getProject(user, id);
  }

  addHypothesis(
    user: AuthenticatedUser,
    input: AddHypothesisInput,
  ): Promise<HypothesisDto> {
    return this.researchService.addHypothesis(user, input);
  }

  listHypotheses(
    user: AuthenticatedUser,
    projectId: string,
  ): Promise<HypothesisDto[]> {
    return this.researchService.listHypotheses(user, projectId);
  }

  getHypothesis(user: AuthenticatedUser, id: string): Promise<HypothesisDto> {
    return this.researchService.getHypothesis(user, id);
  }
}
