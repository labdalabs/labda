import { defineTool } from 'eve/tools';
import { z } from 'zod';
import {
  callerToken,
  FINDING_FIELDS,
  labdaGraphql,
  type ChallengeFinding,
} from '#lib/labda.js';

// The model sees this as `challenge_hypothesis` (from the filename).
export default defineTool({
  description:
    'Challenge a Hypothesis: returns grounded supports/contradicts findings ' +
    'over its attached References (each with a source quote) plus logic-gap ' +
    'detection. Use this to actively find weaknesses in a Hypothesis.',
  inputSchema: z.object({
    hypothesisId: z.string().uuid().describe('The Hypothesis id to challenge.'),
  }),
  async execute({ hypothesisId }, ctx) {
    const data = await labdaGraphql<{ challengeHypothesis: ChallengeFinding[] }>(
      `query ($id: ID!) { challengeHypothesis(hypothesisId: $id) { ${FINDING_FIELDS} } }`,
      { id: hypothesisId },
      callerToken(ctx),
    );
    return { findings: data.challengeHypothesis };
  },
});
