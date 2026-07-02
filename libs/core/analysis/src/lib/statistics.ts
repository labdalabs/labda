import { BadRequestException } from '@nestjs/common';

export interface Dataset {
  columns: string[];
  rows: number[][];
}

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

// Validate + normalize a dataset from arbitrary input (parsed JSON or object).
export function parseDataset(value: unknown): Dataset {
  const obj = (typeof value === 'string' ? safeParse(value) : value) as
    | Record<string, unknown>
    | undefined;
  if (!obj || typeof obj !== 'object') {
    throw new BadRequestException('Dataset must be an object');
  }
  const columns = obj['columns'];
  const rows = obj['rows'];
  if (!Array.isArray(columns) || !columns.every((c) => typeof c === 'string')) {
    throw new BadRequestException('Dataset.columns must be a string array');
  }
  if (!Array.isArray(rows)) {
    throw new BadRequestException('Dataset.rows must be an array');
  }
  const width = columns.length;
  const normRows = rows.map((row, i) => {
    if (!Array.isArray(row) || row.length !== width) {
      throw new BadRequestException(
        `Dataset.rows[${i}] must have ${width} numeric cells`,
      );
    }
    return row.map((cell) => {
      const n = typeof cell === 'number' ? cell : Number(cell);
      if (!Number.isFinite(n)) {
        throw new BadRequestException('Dataset cells must be finite numbers');
      }
      return n;
    });
  });
  if (width === 0) {
    throw new BadRequestException('Dataset must have at least one column');
  }
  return { columns: columns as string[], rows: normRows };
}

// Common analysis helpers: descriptive statistics per column + a bar chart of
// column means.
export function analyzeDataset(data: Dataset): AnalysisResults {
  const stats = data.columns.map((column, c) => {
    const values = data.rows.map((r) => r[c]);
    return columnStats(column, values);
  });
  const chart: ChartSpec = {
    type: 'bar',
    title: 'Mean by column',
    categories: stats.map((s) => s.column),
    values: stats.map((s) => round(s.mean)),
  };
  return { stats, chart };
}

function columnStats(column: string, values: number[]): ColumnStats {
  const count = values.length;
  if (count === 0) {
    return { column, count: 0, mean: 0, median: 0, min: 0, max: 0, std: 0, sum: 0 };
  }
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / count;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(count / 2);
  const median =
    count % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const variance =
    values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / count;
  return {
    column,
    count,
    mean: round(mean),
    median: round(median),
    min: sorted[0],
    max: sorted[count - 1],
    std: round(Math.sqrt(variance)),
    sum: round(sum),
  };
}

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    throw new BadRequestException('Dataset is not valid JSON');
  }
}
