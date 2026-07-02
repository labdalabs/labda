import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import type { AuthenticatedUser } from '@labda/core-common';
import { CopilotService } from '../copilot.service';

interface AuthedRequest {
  user?: AuthenticatedUser;
}

const params = z.object({
  hypothesisId: z
    .string()
    .uuid()
    .describe('The Hypothesis whose References to scan for contradictions.'),
});

type Params = z.infer<typeof params>;

@Injectable()
export class FindContradictingEvidenceTool {
  constructor(private readonly copilotService: CopilotService) {}

  @Tool({
    name: 'find_contradicting_evidence',
    description:
      'Return only the References attached to a Hypothesis that contradict it, ' +
      'each with the contradicting quote and a source link. Grounded output only.',
    parameters: params,
  })
  async execute(p: Params, _ctx: unknown, req: AuthedRequest) {
    const user = req?.user;
    if (!user) throw new UnauthorizedException();
    const findings = await this.copilotService.findContradictingEvidence(
      user,
      p.hypothesisId,
    );
    return { content: [{ type: 'text', text: JSON.stringify(findings) }] };
  }
}
