import { graphql } from '@/lib/api/graphql';
import type { LiteratureResult, Project, Reference } from './types';

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

const REFERENCE_FIELDS = `
  id
  hypothesisId
  source
  externalId
  title
  authors
  year
  venue
  url
  abstract
  createdAt
`;

const LITERATURE_RESULT_FIELDS = `
  externalId
  title
  authors
  year
  venue
  url
  abstract
`;

export async function searchLiterature(
  query: string,
  limit = 10,
): Promise<LiteratureResult[]> {
  const data = await graphql<{ searchLiterature: LiteratureResult[] }>(
    `query SearchLiterature($input: SearchLiteratureInput!) {
      searchLiterature(input: $input) { ${LITERATURE_RESULT_FIELDS} }
    }`,
    { input: { query, limit } },
  );
  return data.searchLiterature;
}

export async function listReferences(
  hypothesisId: string,
): Promise<Reference[]> {
  const data = await graphql<{ references: Reference[] }>(
    `query References($hypothesisId: ID!) {
      references(hypothesisId: $hypothesisId) { ${REFERENCE_FIELDS} }
    }`,
    { hypothesisId },
  );
  return data.references;
}

export async function attachReference(input: {
  hypothesisId: string;
  externalId: string;
  title: string;
  authors?: string[];
  year?: number | null;
  venue?: string | null;
  url?: string | null;
  abstract?: string | null;
}): Promise<Reference> {
  const data = await graphql<{ attachReference: Reference }>(
    `mutation AttachReference($input: AttachReferenceInput!) {
      attachReference(input: $input) { ${REFERENCE_FIELDS} }
    }`,
    { input },
  );
  return data.attachReference;
}
