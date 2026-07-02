import { Injectable, Logger } from '@nestjs/common';
import type { AuthenticatedUser } from '@labda/core-common';
import { CopilotService } from './copilot.service';
import type { Finding } from './challenge';

// Public service-to-service surface of the copilot context (ADR-0005).
@Injectable()
export class CopilotFacade {
  private readonly logger = new Logger(CopilotFacade.name);

  constructor(private readonly copilotService: CopilotService) {}

  challengeHypothesis(
    user: AuthenticatedUser,
    hypothesisId: string,
  ): Promise<Finding[]> {
    return this.copilotService.challengeHypothesis(user, hypothesisId);
  }

  findContradictingEvidence(
    user: AuthenticatedUser,
    hypothesisId: string,
  ): Promise<Finding[]> {
    return this.copilotService.findContradictingEvidence(user, hypothesisId);
  }

  challengeProtocol(
    user: AuthenticatedUser,
    protocolId: string,
  ): Promise<Finding[]> {
    return this.copilotService.challengeProtocol(user, protocolId);
  }
}
