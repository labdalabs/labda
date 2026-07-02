import { graphql } from '@/lib/api/graphql';
import type { Analysis, AnalysisExport } from './types';

const ANALYSIS_FIELDS = `
  id
  protocolId
  name
  inputData
  results
  createdAt
`;

export async function listAnalyses(protocolId: string): Promise<Analysis[]> {
  const data = await graphql<{ analyses: Analysis[] }>(
    `query Analyses($protocolId: ID!) {
      analyses(protocolId: $protocolId) { ${ANALYSIS_FIELDS} }
    }`,
    { protocolId },
  );
  return data.analyses;
}

export async function runAnalysis(input: {
  protocolId: string;
  name: string;
  data: string;
}): Promise<Analysis> {
  const result = await graphql<{ runAnalysis: Analysis }>(
    `mutation RunAnalysis($input: RunAnalysisInput!) {
      runAnalysis(input: $input) { ${ANALYSIS_FIELDS} }
    }`,
    { input },
  );
  return result.runAnalysis;
}

export async function exportAnalysis(id: string): Promise<AnalysisExport> {
  const data = await graphql<{ exportAnalysis: AnalysisExport }>(
    `mutation ExportAnalysis($id: ID!) {
      exportAnalysis(id: $id) { url path }
    }`,
    { id },
  );
  return data.exportAnalysis;
}
