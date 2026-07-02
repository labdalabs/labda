import { Injectable, Logger } from '@nestjs/common';
import { ResearchFacade } from '@labda/core-research';
import { ProtocolFacade } from '@labda/core-protocol';
import type { AuthenticatedUser } from '@labda/core-common';
import {
  classifyReferences,
  detectHypothesisGaps,
  detectProtocolGaps,
  type Finding,
  type ReferenceInput,
} from './challenge';

@Injectable()
export class CopilotService {
  private readonly logger = new Logger(CopilotService.name);

  constructor(
    private readonly researchFacade: ResearchFacade,
    private readonly protocolFacade: ProtocolFacade,
  ) {}

  // Challenge a Hypothesis: supports/contradicts findings over its References
  // (each grounded with a source quote) plus logic-gap detection. Authorization
  // is enforced by the facades (owner-scoped reads).
  async challengeHypothesis(
    user: AuthenticatedUser,
    hypothesisId: string,
  ): Promise<Finding[]> {
    const hypothesis = await this.researchFacade.getHypothesis(
      user,
      hypothesisId,
    );
    const references = await this.researchFacade.listReferences(
      user,
      hypothesisId,
    );

    const refInputs: ReferenceInput[] = references.map((r) => ({
      id: r.id,
      title: r.title,
      abstract: r.abstract,
      url: r.url,
    }));

    const findings = [
      ...classifyReferences(hypothesis.statement, refInputs),
      ...detectHypothesisGaps(hypothesis.statement),
    ];

    this.logger.log(
      { hypothesisId, findings: findings.length },
      'Challenged Hypothesis',
    );
    return findings;
  }

  // Only the contradicting evidence over a Hypothesis's References.
  async findContradictingEvidence(
    user: AuthenticatedUser,
    hypothesisId: string,
  ): Promise<Finding[]> {
    const all = await this.challengeHypothesis(user, hypothesisId);
    return all.filter((f) => f.kind === 'contradicts');
  }

  // Challenge a Protocol: flag missing steps / unhandled branches.
  async challengeProtocol(
    user: AuthenticatedUser,
    protocolId: string,
  ): Promise<Finding[]> {
    const protocol = await this.protocolFacade.getProtocol(user, protocolId);
    const text = extractNotebookText(protocol.notebook);
    const findings = detectProtocolGaps(text);
    this.logger.log(
      { protocolId, findings: findings.length },
      'Challenged Protocol',
    );
    return findings;
  }
}

// Concatenate all cell sources from an nbformat notebook JSON string.
function extractNotebookText(notebookJson: string): string {
  try {
    const nb = JSON.parse(notebookJson) as {
      cells?: { source?: string | string[] }[];
    };
    return (nb.cells ?? [])
      .map((c) => (Array.isArray(c.source) ? c.source.join('') : c.source ?? ''))
      .join('\n');
  } catch {
    return '';
  }
}
