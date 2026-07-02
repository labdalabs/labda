import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { labdaGraphql } from '#lib/labda.js';

const RESULT_FIELDS = 'externalId title authors year venue url';

export default defineTool({
  description:
    'Find recent papers matching a Project\'s Hypotheses (published in/after ' +
    'sinceYear) that are not yet attached — the daily-digest source.',
  inputSchema: z.object({
    projectId: z.string().uuid(),
    sinceYear: z.number().int().optional(),
  }),
  async execute({ projectId, sinceYear }) {
    const data = await labdaGraphql<{ newPapers: unknown[] }>(
      `query ($projectId: ID!, $sinceYear: Int) { newPapers(projectId: $projectId, sinceYear: $sinceYear) { ${RESULT_FIELDS} } }`,
      { projectId, sinceYear: sinceYear ?? 0 },
    );
    return { papers: data.newPapers };
  },
});
