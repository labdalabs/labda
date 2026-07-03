import { graphql } from '@/lib/api/graphql';
import type { KnowledgeGraph, OkfNodeType } from './types';

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

// Author a new knowledge node (idea, observation, data, paper…) as an OKF
// markdown entry, optionally pointing at a source file.
export async function createKnowledgeNode(input: {
  projectId: string;
  type: OkfNodeType;
  title: string;
  content?: string;
  sourceRef?: string;
}): Promise<{ id: string }> {
  const data = await graphql<{ createKnowledgeNode: { id: string } }>(
    `mutation CreateKnowledgeNode($input: CreateKnowledgeNodeInput!) {
      createKnowledgeNode(input: $input) { id type title }
    }`,
    { input },
  );
  return data.createKnowledgeNode;
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
