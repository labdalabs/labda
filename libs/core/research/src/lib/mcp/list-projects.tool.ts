import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import type { AuthenticatedUser } from '@labda/core-common';
import { ResearchService } from '../research.service';

interface AuthedRequest {
  user?: AuthenticatedUser;
}

const listProjectsParameters = z.object({
  includeHypotheses: z
    .boolean()
    .optional()
    .describe('When true, include each Project\'s Hypotheses in the result.'),
});

type ListProjectsParams = z.infer<typeof listProjectsParameters>;

@Injectable()
export class ListProjectsTool {
  constructor(private readonly researchService: ResearchService) {}

  @Tool({
    name: 'list_projects',
    description:
      'List the research Projects owned by the authenticated researcher, ' +
      'newest first. Optionally includes each Project\'s Hypotheses.',
    parameters: listProjectsParameters,
  })
  async execute(params: ListProjectsParams, _ctx: unknown, req: AuthedRequest) {
    const user = req?.user;
    if (!user) throw new UnauthorizedException();

    const projects = await this.researchService.listProjects(user);
    const result = params.includeHypotheses
      ? await Promise.all(
          projects.map(async (p) => ({
            ...p,
            hypotheses: await this.researchService.listHypotheses(user, p.id),
          })),
        )
      : projects;

    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
  }
}
