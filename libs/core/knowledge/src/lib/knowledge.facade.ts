import { Injectable, Logger } from '@nestjs/common';
import type { AuthenticatedUser } from '@labda/core-common';
import { KnowledgeService } from './knowledge.service';
import type { OkfGraph } from './okf';

// Public service-to-service surface of the knowledge context (ADR-0005).
@Injectable()
export class KnowledgeFacade {
  private readonly logger = new Logger(KnowledgeFacade.name);

  constructor(private readonly knowledgeService: KnowledgeService) {}

  knowledgeGraph(
    user: AuthenticatedUser,
    projectId: string,
  ): Promise<OkfGraph> {
    return this.knowledgeService.knowledgeGraph(user, projectId);
  }

  exportOkf(
    user: AuthenticatedUser,
    projectId: string,
  ): Promise<{ url: string; path: string }> {
    return this.knowledgeService.exportOkf(user, projectId);
  }
}
