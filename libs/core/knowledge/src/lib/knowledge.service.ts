import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '@labda/core-common';
import type { AuthenticatedUser } from '@labda/core-common';
import { ResearchFacade } from '@labda/core-research';
import { ProtocolFacade } from '@labda/core-protocol';
import { CopilotFacade } from '@labda/core-copilot';
import {
  buildOkfGraph,
  neighbours,
  type GraphInputs,
  type OkfGraph,
} from './okf';

const OKF_BUCKET = 'knowledge-okf';
const SIGNED_URL_TTL_SEC = 60 * 60;

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    @Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseClient,
    private readonly researchFacade: ResearchFacade,
    private readonly protocolFacade: ProtocolFacade,
    private readonly copilotFacade: CopilotFacade,
  ) {}

  // Derive the OKF graph for a Project from the current entities + grounded
  // copilot stances. Owner-scoped via the facades.
  async knowledgeGraph(
    user: AuthenticatedUser,
    projectId: string,
  ): Promise<OkfGraph> {
    const project = await this.researchFacade.getProject(user, projectId);
    const hypotheses = await this.researchFacade.listHypotheses(user, projectId);
    const protocols = await this.protocolFacade.listProtocols(user, projectId);

    const referencesByHypothesis: GraphInputs['referencesByHypothesis'] = {};
    const stancesByHypothesis: GraphInputs['stancesByHypothesis'] = {};

    for (const h of hypotheses) {
      const refs = await this.researchFacade.listReferences(user, h.id);
      referencesByHypothesis[h.id] = refs.map((r) => ({
        id: r.id,
        title: r.title,
        url: r.url,
      }));

      const findings = await this.copilotFacade.challengeHypothesis(user, h.id);
      stancesByHypothesis[h.id] = findings
        .filter(
          (f) =>
            (f.kind === 'supports' || f.kind === 'contradicts') &&
            !!f.referenceId,
        )
        .map((f) => ({
          referenceId: f.referenceId as string,
          predicate: f.kind as 'supports' | 'contradicts',
          quote: f.quote,
        }));
    }

    return buildOkfGraph({
      project: {
        id: project.id,
        title: project.title,
        description: project.description,
      },
      hypotheses: hypotheses.map((h) => ({ id: h.id, statement: h.statement })),
      referencesByHypothesis,
      stancesByHypothesis,
      protocols: protocols.map((p) => ({
        id: p.id,
        title: p.title,
        version: p.version,
      })),
    });
  }

  // fff-style free browse: the neighbourhood of a node in the Project graph.
  async browse(
    user: AuthenticatedUser,
    projectId: string,
    nodeId: string,
  ): Promise<ReturnType<typeof neighbours>> {
    const graph = await this.knowledgeGraph(user, projectId);
    return neighbours(graph, nodeId);
  }

  // Export the OKF graph as JSON to Supabase Storage; return a signed URL.
  async exportOkf(
    user: AuthenticatedUser,
    projectId: string,
  ): Promise<{ url: string; path: string }> {
    const graph = await this.knowledgeGraph(user, projectId);
    const path = `${user.id}/${projectId}.okf.json`;
    const body = Buffer.from(JSON.stringify(graph, null, 2));

    const { error: uploadError } = await this.supabase.storage
      .from(OKF_BUCKET)
      .upload(path, body, { contentType: 'application/json', upsert: true });
    if (uploadError) {
      this.logger.error('Failed to upload OKF export', { uploadError });
      throw new Error('Failed to store the knowledge export');
    }

    const { data: signed, error: signError } = await this.supabase.storage
      .from(OKF_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SEC);
    if (signError || !signed) {
      throw new Error('Failed to produce a download URL');
    }
    this.logger.log({ projectId, path }, 'Exported OKF knowledge graph');
    return { url: signed.signedUrl, path };
  }
}
