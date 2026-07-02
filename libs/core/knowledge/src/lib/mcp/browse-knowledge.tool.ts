import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import type { AuthenticatedUser } from '@labda/core-common';
import { KnowledgeService } from '../knowledge.service';

interface AuthedRequest {
  user?: AuthenticatedUser;
}

const params = z.object({
  projectId: z.string().uuid().describe('The Project whose knowledge graph to browse.'),
  nodeId: z
    .string()
    .optional()
    .describe(
      'A node id to get the neighbourhood of (fff-style browse). Omit to get the whole graph.',
    ),
});

type Params = z.infer<typeof params>;

@Injectable()
export class BrowseKnowledgeTool {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Tool({
    name: 'browse_knowledge',
    description:
      'Browse the OKF knowledge graph of a Project: entities (Project, ' +
      'Hypothesis, Protocol, Reference) as nodes and typed relations ' +
      '(contains, cites, supports, contradicts) as edges. Pass a nodeId to walk ' +
      'the graph from that node (fff-style free browse).',
    parameters: params,
  })
  async execute(p: Params, _ctx: unknown, req: AuthedRequest) {
    const user = req?.user;
    if (!user) throw new UnauthorizedException();
    const result = p.nodeId
      ? await this.knowledgeService.browse(user, p.projectId, p.nodeId)
      : await this.knowledgeService.knowledgeGraph(user, p.projectId);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
}
