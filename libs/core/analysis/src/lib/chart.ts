import type { ChartSpec } from './statistics';

// Render a bar chart to a standalone SVG string (no browser / DOM needed).
// GraphPad/Prism-style: labelled bars with a value axis.
export function chartToSvg(chart: ChartSpec): string {
  const width = 640;
  const height = 360;
  const padding = { top: 40, right: 20, bottom: 60, left: 50 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const values = chart.values;
  const maxV = Math.max(1, ...values.map((v) => Math.abs(v)));
  const n = Math.max(1, values.length);
  const bandW = plotW / n;
  const barW = bandW * 0.6;

  const bars = values
    .map((v, i) => {
      const h = (Math.abs(v) / maxV) * plotH;
      const x = padding.left + i * bandW + (bandW - barW) / 2;
      const y = padding.top + (plotH - h);
      const label = escapeXml(chart.categories[i] ?? `#${i + 1}`);
      return `
        <rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(barW)}" height="${fmt(h)}" fill="#4A95CC" />
        <text x="${fmt(x + barW / 2)}" y="${fmt(y - 6)}" font-size="12" text-anchor="middle" fill="#333">${v}</text>
        <text x="${fmt(x + barW / 2)}" y="${fmt(height - padding.bottom + 18)}" font-size="12" text-anchor="middle" fill="#333">${label}</text>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#ffffff" />
  <text x="${width / 2}" y="24" font-size="16" font-weight="bold" text-anchor="middle" fill="#111">${escapeXml(chart.title)}</text>
  <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + plotH}" stroke="#999" />
  <line x1="${padding.left}" y1="${padding.top + plotH}" x2="${padding.left + plotW}" y2="${padding.top + plotH}" stroke="#999" />
  ${bars}
</svg>`;
}

// Rasterize an SVG chart to a PNG buffer via sharp (lazy-required so it isn't
// pulled into unit tests that don't need it).
export async function chartToPng(chart: ChartSpec): Promise<Buffer> {
  const svg = chartToSvg(chart);
  const sharp = require('sharp');
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
