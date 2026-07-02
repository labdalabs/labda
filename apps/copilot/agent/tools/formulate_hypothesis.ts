import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { labdaGraphql } from '#lib/labda.js';

export default defineTool({
  description:
    'Add a Hypothesis (a testable claim) to a Project. Use after helping the ' +
    'researcher formulate a precise, falsifiable statement.',
  inputSchema: z.object({
    projectId: z.string().uuid(),
    statement: z.string().min(1).max(2000).describe('The testable claim.'),
    rationale: z.string().max(4000).optional(),
  }),
  async execute(input) {
    const data = await labdaGraphql<{ addHypothesis: { id: string } }>(
      `mutation ($input: AddHypothesisInput!) { addHypothesis(input: $input) { id statement } }`,
      { input },
    );
    return data.addHypothesis;
  },
});
