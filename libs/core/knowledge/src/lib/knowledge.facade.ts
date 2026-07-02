import { Injectable, Logger } from '@nestjs/common';
import type { AuthenticatedUser } from '@labda/core-common';
import { KnowledgeService, type OkfLocalExport } from './knowledge.service';
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

  // Remote: OKF bundle to Supabase Storage (signed URL to index.md).
  exportOkf(
    user: AuthenticatedUser,
    projectId: string,
  ): Promise<{ url: string; path: string }> {
    return this.knowledgeService.exportOkf(user, projectId);
  }

  // Local: OKF bundle to the filesystem (e.g. /tmp/labda) — the agent's copy.
  exportOkfLocal(
    user: AuthenticatedUser,
    projectId: string,
    baseDir?: string,
  ): Promise<OkfLocalExport> {
    return this.knowledgeService.exportOkfLocal(user, projectId, baseDir);
  }
}
