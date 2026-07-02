import { defineTool } from 'eve/tools';
import { z } from 'zod';
import {
  FINDING_FIELDS,
  labdaGraphql,
  type ChallengeFinding,
} from '#lib/labda.js';

// The model sees this as `find_contradicting_evidence`.
export default defineTool({
  description:
    'Return only the References attached to a Hypothesis that contradict it, ' +
    'each with the contradicting quote and a source link. Grounded output only.',
  inputSchema: z.object({
    hypothesisId: z.string().uuid().describe('The Hypothesis id to scan.'),
  }),
  async execute({ hypothesisId }) {
    // The GraphQL surface returns all findings; filter to contradictions so the
    // model gets exactly what it asked for.
    const data = await labdaGraphql<{ challengeHypothesis: ChallengeFinding[] }>(
      `query ($id: ID!) { challengeHypothesis(hypothesisId: $id) { ${FINDING_FIELDS} } }`,
      { id: hypothesisId },
    );
    return {
      contradictions: data.challengeHypothesis.filter(
        (f) => f.kind === 'CONTRADICTS',
      ),
    };
  },
});
