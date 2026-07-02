import { graphql } from '@/lib/api/graphql';
import type { Protocol } from './types';

const PROTOCOL_FIELDS = `
  id
  projectId
  title
  version
  notebook
  createdAt
  updatedAt
`;

export async function listProtocols(projectId: string): Promise<Protocol[]> {
  const data = await graphql<{ protocols: Protocol[] }>(
    `query Protocols($projectId: ID!) {
      protocols(projectId: $projectId) { ${PROTOCOL_FIELDS} }
    }`,
    { projectId },
  );
  return data.protocols;
}

export async function getProtocol(id: string): Promise<Protocol> {
  const data = await graphql<{ protocol: Protocol }>(
    `query Protocol($id: ID!) { protocol(id: $id) { ${PROTOCOL_FIELDS} } }`,
    { id },
  );
  return data.protocol;
}

export async function createProtocol(input: {
  projectId: string;
  title: string;
  notebook?: string;
}): Promise<Protocol> {
  const data = await graphql<{ createProtocol: Protocol }>(
    `mutation CreateProtocol($input: CreateProtocolInput!) {
      createProtocol(input: $input) { ${PROTOCOL_FIELDS} }
    }`,
    { input },
  );
  return data.createProtocol;
}

export async function saveProtocol(input: {
  id: string;
  title?: string;
  notebook: string;
}): Promise<Protocol> {
  const data = await graphql<{ saveProtocol: Protocol }>(
    `mutation SaveProtocol($input: SaveProtocolInput!) {
      saveProtocol(input: $input) { ${PROTOCOL_FIELDS} }
    }`,
    { input },
  );
  return data.saveProtocol;
}
