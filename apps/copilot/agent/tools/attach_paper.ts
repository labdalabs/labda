import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { callerToken, labdaGraphql } from '#lib/labda.js';

export default defineTool({
  description:
    'Attach a searched paper to a Hypothesis as a Reference (preserving ' +
    'provenance). Use the fields from search_papers.',
  inputSchema: z.object({
    hypothesisId: z.string().uuid(),
    externalId: z.string(),
    title: z.string(),
    authors: z.array(z.string()).optional(),
    year: z.number().int().optional(),
    venue: z.string().optional(),
    url: z.string().optional(),
    abstract: z.string().optional(),
  }),
  async execute(input, ctx) {
    const data = await labdaGraphql<{ attachReference: { id: string } }>(
      `mutation ($input: AttachReferenceInput!) { attachReference(input: $input) { id title } }`,
      { input },
      callerToken(ctx),
    );
    return data.attachReference;
  },
});
