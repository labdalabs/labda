import { graphql } from '@/lib/api/graphql';

export type ChallengeFindingKind =
  | 'CONTRADICTS'
  | 'SUPPORTS'
  | 'LOGIC_GAP'
  | 'MISSING_STEP';

export interface ChallengeFinding {
  kind: ChallengeFindingKind;
  summary: string;
  referenceId: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  quote: string | null;
}

const FINDING_FIELDS = `
  kind
  summary
  referenceId
  sourceTitle
  sourceUrl
  quote
`;

export async function challengeHypothesis(
  hypothesisId: string,
): Promise<ChallengeFinding[]> {
  const data = await graphql<{ challengeHypothesis: ChallengeFinding[] }>(
    `query ChallengeHypothesis($hypothesisId: ID!) {
      challengeHypothesis(hypothesisId: $hypothesisId) { ${FINDING_FIELDS} }
    }`,
    { hypothesisId },
  );
  return data.challengeHypothesis;
}

export async function challengeProtocol(
  protocolId: string,
): Promise<ChallengeFinding[]> {
  const data = await graphql<{ challengeProtocol: ChallengeFinding[] }>(
    `query ChallengeProtocol($protocolId: ID!) {
      challengeProtocol(protocolId: $protocolId) { ${FINDING_FIELDS} }
    }`,
    { protocolId },
  );
  return data.challengeProtocol;
}
