import { graphql } from '@/lib/api/graphql';
import type { Project } from './types';

const PROJECT_FIELDS = `
  id
  title
  description
  createdAt
  updatedAt
`;

const HYPOTHESIS_FIELDS = `
  id
  projectId
  statement
  rationale
  createdAt
  updatedAt
`;

export async function listProjects(): Promise<Project[]> {
  const data = await graphql<{ myProjects: Project[] }>(
    `query MyProjects { myProjects { ${PROJECT_FIELDS} } }`,
  );
  return data.myProjects;
}

export async function getProject(id: string): Promise<Project> {
  const data = await graphql<{ project: Project }>(
    `query Project($id: ID!) {
      project(id: $id) {
        ${PROJECT_FIELDS}
        hypotheses { ${HYPOTHESIS_FIELDS} }
      }
    }`,
    { id },
  );
  return data.project;
}

export async function createProject(input: {
  title: string;
  description?: string;
}): Promise<Project> {
  const data = await graphql<{ createProject: Project }>(
    `mutation CreateProject($input: CreateProjectInput!) {
      createProject(input: $input) { ${PROJECT_FIELDS} }
    }`,
    { input },
  );
  return data.createProject;
}

export async function addHypothesis(input: {
  projectId: string;
  statement: string;
  rationale?: string;
}): Promise<Project['hypotheses']> {
  const data = await graphql<{ addHypothesis: Project['hypotheses'] }>(
    `mutation AddHypothesis($input: AddHypothesisInput!) {
      addHypothesis(input: $input) { ${HYPOTHESIS_FIELDS} }
    }`,
    { input },
  );
  return data.addHypothesis;
}
