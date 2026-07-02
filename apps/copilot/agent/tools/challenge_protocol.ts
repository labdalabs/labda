import { defineTool } from 'eve/tools';
import { z } from 'zod';
import {
  callerToken,
  FINDING_FIELDS,
  labdaGraphql,
  type ChallengeFinding,
} from '#lib/labda.js';

// The model sees this as `challenge_protocol`.
export default defineTool({
  description:
    'Challenge a Protocol (a Jupyter notebook): flags missing steps / unhandled ' +
    'branches — missing controls, replication, randomization, or statistics.',
  inputSchema: z.object({
    protocolId: z.string().uuid().describe('The Protocol id to challenge.'),
  }),
  async execute({ protocolId }, ctx) {
    const data = await labdaGraphql<{ challengeProtocol: ChallengeFinding[] }>(
      `query ($id: ID!) { challengeProtocol(protocolId: $id) { ${FINDING_FIELDS} } }`,
      { id: protocolId },
      callerToken(ctx),
    );
    return { findings: data.challengeProtocol };
  },
});
