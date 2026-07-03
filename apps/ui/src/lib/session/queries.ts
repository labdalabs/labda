import { graphql } from '@/lib/api/graphql';

// A persisted agent session: an EVE thread scoped to a project + goal. The
// transcript (raw event stream) and session cursor are stored as JSON strings
// so the conversation resumes exactly on reload.
export interface AgentSession {
  id: string;
  projectId: string;
  goal: string;
  transcript: string; // JSON array of eve stream events (default "[]")
  sessionState: string | null; // JSON of the eve session cursor
  createdAt: string;
}

const SESSION_FIELDS = `id projectId goal transcript sessionState createdAt`;

export async function listSessions(projectId: string): Promise<AgentSession[]> {
  const data = await graphql<{ sessions: AgentSession[] }>(
    `query Sessions($projectId: ID!) {
      sessions(projectId: $projectId) { ${SESSION_FIELDS} }
    }`,
    { projectId },
  );
  return data.sessions;
}

export async function createAgentSession(input: {
  projectId: string;
  goal: string;
}): Promise<AgentSession> {
  const data = await graphql<{ createAgentSession: AgentSession }>(
    `mutation CreateAgentSession($input: CreateAgentSessionInput!) {
      createAgentSession(input: $input) { ${SESSION_FIELDS} }
    }`,
    { input },
  );
  return data.createAgentSession;
}

export async function saveAgentSession(input: {
  id: string;
  transcript: string;
  sessionState?: string;
}): Promise<boolean> {
  const data = await graphql<{ saveAgentSession: boolean }>(
    `mutation SaveAgentSession($input: SaveAgentSessionInput!) {
      saveAgentSession(input: $input)
    }`,
    { input },
  );
  return data.saveAgentSession;
}

export async function deleteAgentSession(id: string): Promise<boolean> {
  const data = await graphql<{ deleteAgentSession: boolean }>(
    `mutation DeleteAgentSession($id: ID!) { deleteAgentSession(id: $id) }`,
    { id },
  );
  return data.deleteAgentSession;
}
