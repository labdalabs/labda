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
        nodes { id type label attributes q r }
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

export async function updateKnowledgeNode(input: {
  id: string;
  title?: string;
  content?: string;
}): Promise<{ id: string }> {
  const data = await graphql<{ updateKnowledgeNode: { id: string } }>(
    `mutation UpdateKnowledgeNode($input: UpdateKnowledgeNodeInput!) {
      updateKnowledgeNode(input: $input) { id title }
    }`,
    { input },
  );
  return data.updateKnowledgeNode;
}

export async function deleteKnowledgeNode(id: string): Promise<boolean> {
  const data = await graphql<{ deleteKnowledgeNode: boolean }>(
    `mutation DeleteKnowledgeNode($id: ID!) { deleteKnowledgeNode(id: $id) }`,
    { id },
  );
  return data.deleteKnowledgeNode;
}

export async function unlinkKnowledge(linkId: string): Promise<boolean> {
  const data = await graphql<{ unlinkKnowledge: boolean }>(
    `mutation UnlinkKnowledge($linkId: ID!) { unlinkKnowledge(linkId: $linkId) }`,
    { linkId },
  );
  return data.unlinkKnowledge;
}

// Place/move a node on the hex board (axial coords).
export async function setNodePosition(input: {
  projectId: string;
  nodeId: string;
  q: number;
  r: number;
}): Promise<boolean> {
  const data = await graphql<{ setNodePosition: boolean }>(
    `mutation SetNodePosition($input: SetNodePositionInput!) {
      setNodePosition(input: $input)
    }`,
    { input },
  );
  return data.setNodePosition;
}

export interface OkfFileMeta {
  path: string;
  title: string;
  dir: string;
  editable: boolean;
  nodeId: string | null;
}

// The real OKF bundle rendered from the project graph — a browsable file tree.
export async function okfFiles(projectId: string): Promise<OkfFileMeta[]> {
  const data = await graphql<{ okfFiles: OkfFileMeta[] }>(
    `query OkfFiles($projectId: ID!) {
      okfFiles(projectId: $projectId) { path title dir editable nodeId }
    }`,
    { projectId },
  );
  return data.okfFiles;
}

export async function okfFile(
  projectId: string,
  path: string,
): Promise<{ path: string; content: string }> {
  const data = await graphql<{ okfFile: { path: string; content: string } }>(
    `query OkfFile($projectId: ID!, $path: String!) {
      okfFile(projectId: $projectId, path: $path) { path content }
    }`,
    { projectId, path },
  );
  return data.okfFile;
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
