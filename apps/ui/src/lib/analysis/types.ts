export interface ColumnStats {
  column: string;
  count: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  std: number;
  sum: number;
}

export interface ChartSpec {
  type: 'bar';
  title: string;
  categories: string[];
  values: number[];
}

export interface AnalysisResults {
  stats: ColumnStats[];
  chart: ChartSpec;
}

export interface Analysis {
  id: string;
  protocolId: string;
  name: string;
  inputData: string; // JSON string
  results: string; // JSON string
  createdAt: string;
}

export interface AnalysisExport {
  url: string;
  path: string;
}
