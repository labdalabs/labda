import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '@labda/core-common';
import type { AuthenticatedUser } from '@labda/core-common';
import { CopilotService } from './copilot.service';
import { ChallengeFinding, toFindingKind } from './copilot.models';
import type { Finding } from './challenge';

function toGql(f: Finding): ChallengeFinding {
  return {
    kind: toFindingKind(f.kind),
    summary: f.summary,
    referenceId: f.referenceId,
    sourceTitle: f.sourceTitle,
    sourceUrl: f.sourceUrl,
    quote: f.quote,
  };
}

@Resolver(() => ChallengeFinding)
export class CopilotResolver {
  constructor(private readonly copilotService: CopilotService) {}

  @Query(() => [ChallengeFinding], { name: 'challengeHypothesis' })
  async challengeHypothesis(
    @CurrentUser() user: AuthenticatedUser,
    @Args('hypothesisId', { type: () => ID }) hypothesisId: string,
  ): Promise<ChallengeFinding[]> {
    const findings = await this.copilotService.challengeHypothesis(
      user,
      hypothesisId,
    );
    return findings.map(toGql);
  }

  @Query(() => [ChallengeFinding], { name: 'challengeProtocol' })
  async challengeProtocol(
    @CurrentUser() user: AuthenticatedUser,
    @Args('protocolId', { type: () => ID }) protocolId: string,
  ): Promise<ChallengeFinding[]> {
    const findings = await this.copilotService.challengeProtocol(
      user,
      protocolId,
    );
    return findings.map(toGql);
  }
}
