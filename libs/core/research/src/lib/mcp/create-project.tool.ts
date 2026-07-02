import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import type { AuthenticatedUser } from '@labda/core-common';
import { ResearchService } from '../research.service';

interface AuthedRequest {
  user?: AuthenticatedUser;
}

const createProjectParameters = z.object({
  title: z
    .string()
    .min(1)
    .max(200)
    .describe('Title of the Project (a research initiative).'),
  description: z
    .string()
    .max(4000)
    .optional()
    .describe('Optional description of what the Project investigates.'),
});

type CreateProjectParams = z.infer<typeof createProjectParameters>;

@Injectable()
export class CreateProjectTool {
  constructor(private readonly researchService: ResearchService) {}

  @Tool({
    name: 'create_project',
    description:
      'Create a new research Project owned by the authenticated researcher. ' +
      'A Project is the container for Hypotheses, Protocols and References.',
    parameters: createProjectParameters,
  })
  async execute(params: CreateProjectParams, _ctx: unknown, req: AuthedRequest) {
    const user = req?.user;
    if (!user) throw new UnauthorizedException();
    const created = await this.researchService.createProject(user, params);
    return {
      content: [{ type: 'text', text: JSON.stringify(created) }],
    };
  }
}
