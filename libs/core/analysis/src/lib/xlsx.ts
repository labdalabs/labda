import { chartToPng } from './chart';
import type { AnalysisResults, Dataset } from './statistics';

// Build an `.xlsx` workbook (data + summary stats + an embedded chart image)
// for an Analysis. Returns the file as a Buffer. exceljs is lazy-required so
// unit tests that don't export stay light.
export async function buildAnalysisWorkbook(
  name: string,
  data: Dataset,
  results: AnalysisResults,
): Promise<Buffer> {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Labda';
  wb.created = new Date(0); // deterministic; caller stamps real time elsewhere

  // Data sheet — the raw dataset.
  const dataSheet = wb.addWorksheet('Data');
  dataSheet.addRow(data.columns);
  for (const row of data.rows) dataSheet.addRow(row);
  dataSheet.getRow(1).font = { bold: true };

  // Summary sheet — descriptive statistics per column.
  const summary = wb.addWorksheet('Summary');
  summary.addRow(['column', 'count', 'mean', 'median', 'min', 'max', 'std', 'sum']);
  summary.getRow(1).font = { bold: true };
  for (const s of results.stats) {
    summary.addRow([s.column, s.count, s.mean, s.median, s.min, s.max, s.std, s.sum]);
  }

  // Chart sheet — the generated chart as an embedded PNG image.
  const chartSheet = wb.addWorksheet('Chart');
  chartSheet.addRow([results.chart.title]).font = { bold: true };
  const png = await chartToPng(results.chart);
  const imageId = wb.addImage({ buffer: png, extension: 'png' });
  chartSheet.addImage(imageId, {
    tl: { col: 0, row: 2 },
    ext: { width: 640, height: 360 },
  });

  const out = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  return Buffer.from(out);
}
