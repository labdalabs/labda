import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { callerToken, labdaGraphql } from '#lib/labda.js';

// Crawl the OKF knowledge graph node-by-node. From a chosen starting node the
// agent gets that node, its typed relations (edges), and the neighbouring nodes,
// so it can walk the graph step by step to build up an observation or answer.
export default defineTool({
  description:
    'Crawl the OKF from one node: returns that node, its typed relations ' +
    '(edges), and the neighbouring nodes — so you can walk the knowledge graph ' +
    'step by step from a chosen starting point (e.g. what the researcher ' +
    'recently selected) to build up an observation or answer.',
  inputSchema: z.object({
    projectId: z.string().uuid(),
    nodeId: z.string(),
  }),
  async execute({ projectId, nodeId }, ctx) {
    const data = await labdaGraphql<{ knowledgeNeighbours: unknown }>(
      `query ($projectId: ID!, $nodeId: String!) {
        knowledgeNeighbours(projectId: $projectId, nodeId: $nodeId) {
          node { id type label }
          edges { from to predicate }
          neighbours { id type label }
        }
      }`,
      { projectId, nodeId },
      callerToken(ctx),
    );
    return data.knowledgeNeighbours;
  },
});
