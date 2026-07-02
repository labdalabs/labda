import { graphql } from '@/lib/api/graphql';
import type { KnowledgeGraph } from './types';

export async function knowledgeGraph(
  projectId: string,
): Promise<KnowledgeGraph> {
  const data = await graphql<{ knowledgeGraph: KnowledgeGraph }>(
    `query KnowledgeGraph($projectId: ID!) {
      knowledgeGraph(projectId: $projectId) {
        format
        rootId
        nodes { id type label attributes }
        edges { id from to predicate attributes }
      }
    }`,
    { projectId },
  );
  return data.knowledgeGraph;
}

export async function linkKnowledge(input: {
  projectId: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
}): Promise<{ id: string }> {
  const data = await graphql<{ linkKnowledge: { id: string } }>(
    `mutation LinkKnowledge($input: LinkNodesInput!) {
      linkKnowledge(input: $input) { id fromNodeId toNodeId label }
    }`,
    { input },
  );
  return data.linkKnowledge;
}

export async function exportKnowledge(
  projectId: string,
): Promise<{ url: string; path: string }> {
  const data = await graphql<{ exportKnowledge: { url: string; path: string } }>(
    `mutation ExportKnowledge($projectId: ID!) {
      exportKnowledge(projectId: $projectId) { url path }
    }`,
    { projectId },
  );
  return data.exportKnowledge;
}
