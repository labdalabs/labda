import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { callerToken, labdaGraphql } from '#lib/labda.js';

// Materialise the Project's OKF Knowledge Bundle to the local filesystem
// (server default /tmp/labda/<projectId>) so the agent can initialise/browse a
// local OKF copy (with fff) rather than round-tripping the API.
export default defineTool({
  description:
    'Write the Project\'s OKF knowledge bundle (markdown files) to the local ' +
    'filesystem so it can be browsed locally (e.g. with fff). Returns the dir ' +
    'and file list.',
  inputSchema: z.object({
    projectId: z.string().uuid(),
  }),
  async execute({ projectId }, ctx) {
    const data = await labdaGraphql<{
      exportKnowledgeLocal: { dir: string; files: string[] };
    }>(
      `mutation ($projectId: ID!) { exportKnowledgeLocal(projectId: $projectId) { dir files } }`,
      { projectId },
      callerToken(ctx),
    );
    return data.exportKnowledgeLocal;
  },
});
