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
    .describe('The Hypothesis to challenge (must be owned by the caller).'),
});

type Params = z.infer<typeof params>;

@Injectable()
export class ChallengeHypothesisTool {
  constructor(private readonly copilotService: CopilotService) {}

  @Tool({
    name: 'challenge_hypothesis',
    description:
      'Challenge a Hypothesis: return supports/contradicts findings over its ' +
      'attached References (each grounded with a source quote) plus logic-gap ' +
      'detection. Every push-back is grounded — no vibes-based output.',
    parameters: params,
  })
  async execute(p: Params, _ctx: unknown, req: AuthedRequest) {
    const user = req?.user;
    if (!user) throw new UnauthorizedException();
    const findings = await this.copilotService.challengeHypothesis(
      user,
      p.hypothesisId,
    );
    return { content: [{ type: 'text', text: JSON.stringify(findings) }] };
  }
}
