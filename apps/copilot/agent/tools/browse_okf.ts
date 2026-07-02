import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { labdaGraphql } from '#lib/labda.js';

// Browse the OKF knowledge graph of a Project (fff-style). The antagonistic
// agent walks nodes (Project, Hypothesis, Protocol, Reference) and typed edges
// (contains, cites, supports, contradicts, linked) to ground its suggestions.
export default defineTool({
  description:
    'Browse a Project\'s OKF knowledge graph: entities as nodes and typed ' +
    'relations (contains, cites, supports, contradicts, linked) as edges. ' +
    'Ground suggestions in the returned graph.',
  inputSchema: z.object({
    projectId: z.string().uuid(),
  }),
  async execute({ projectId }) {
    const data = await labdaGraphql<{ knowledgeGraph: unknown }>(
      `query ($projectId: ID!) {
        knowledgeGraph(projectId: $projectId) {
          rootId
          nodes { id type label }
          edges { from to predicate }
        }
      }`,
      { projectId },
    );
    return data.knowledgeGraph;
  },
});
