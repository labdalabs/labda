import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { labdaGraphql } from '#lib/labda.js';

export default defineTool({
  description:
    'Start a new research Project for the researcher. Returns the new Project id.',
  inputSchema: z.object({
    title: z.string().min(1).max(200).describe('Title of the Project.'),
    description: z.string().max(4000).optional(),
  }),
  async execute(input) {
    const data = await labdaGraphql<{ createProject: { id: string; title: string } }>(
      `mutation ($input: CreateProjectInput!) { createProject(input: $input) { id title } }`,
      { input },
    );
    return data.createProject;
  },
});
