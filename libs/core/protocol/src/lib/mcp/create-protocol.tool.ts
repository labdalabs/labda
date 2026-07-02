import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import type { AuthenticatedUser } from '@labda/core-common';
import { ProtocolService } from '../protocol.service';

interface AuthedRequest {
  user?: AuthenticatedUser;
}

const createProtocolParameters = z.object({
  projectId: z.string().uuid().describe('The Project to add the Protocol to.'),
  title: z.string().min(1).max(200).describe('Title of the Protocol.'),
  notebook: z
    .string()
    .optional()
    .describe(
      'Optional nbformat-4 notebook JSON. Omit to create an empty notebook.',
    ),
});

type CreateProtocolParams = z.infer<typeof createProtocolParameters>;

@Injectable()
export class CreateProtocolTool {
  constructor(private readonly protocolService: ProtocolService) {}

  @Tool({
    name: 'create_protocol',
    description:
      'Create a new experiment Protocol (a Jupyter-compatible notebook) in a ' +
      'Project owned by the authenticated researcher.',
    parameters: createProtocolParameters,
  })
  async execute(params: CreateProtocolParams, _ctx: unknown, req: AuthedRequest) {
    const user = req?.user;
    if (!user) throw new UnauthorizedException();
    const created = await this.protocolService.createProtocol(user, params);
    return {
      content: [{ type: 'text', text: JSON.stringify(created) }],
    };
  }
}
