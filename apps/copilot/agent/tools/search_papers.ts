import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { callerToken, labdaGraphql } from '#lib/labda.js';

const RESULT_FIELDS = 'externalId title authors year venue url abstract';

export default defineTool({
  description:
    'Search the published literature (open library / Semantic Scholar) for ' +
    'papers matching a query. Returns title, authors, year, venue and link.',
  inputSchema: z.object({
    query: z.string().min(1),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  async execute(input, ctx) {
    const data = await labdaGraphql<{ searchLiterature: unknown[] }>(
      `query ($input: SearchLiteratureInput!) { searchLiterature(input: $input) { ${RESULT_FIELDS} } }`,
      { input },
      callerToken(ctx),
    );
    return { results: data.searchLiterature };
  },
});
