import { BadRequestException } from '@nestjs/common';
import { analyzeDataset, parseDataset } from './statistics';

describe('statistics', () => {
  describe('parseDataset', () => {
    it('parses a valid dataset from a JSON string', () => {
      const ds = parseDataset(
        JSON.stringify({ columns: ['a', 'b'], rows: [[1, 2], [3, 4]] }),
      );
      expect(ds.columns).toEqual(['a', 'b']);
      expect(ds.rows).toEqual([[1, 2], [3, 4]]);
    });

    it('coerces numeric strings', () => {
      const ds = parseDataset({ columns: ['a'], rows: [['1'], ['2']] });
      expect(ds.rows).toEqual([[1], [2]]);
    });

    it('rejects ragged rows', () => {
      expect(() =>
        parseDataset({ columns: ['a', 'b'], rows: [[1]] }),
      ).toThrow(BadRequestException);
    });

    it('rejects non-numeric cells', () => {
      expect(() =>
        parseDataset({ columns: ['a'], rows: [['x']] }),
      ).toThrow(BadRequestException);
    });

    it('rejects an empty column set', () => {
      expect(() => parseDataset({ columns: [], rows: [] })).toThrow(
        BadRequestException,
      );
    });
  });

  describe('analyzeDataset', () => {
    it('computes descriptive statistics per column', () => {
      const results = analyzeDataset({
        columns: ['x', 'y'],
        rows: [
          [2, 10],
          [4, 20],
          [6, 30],
        ],
      });
      const x = results.stats[0];
      expect(x).toMatchObject({
        column: 'x',
        count: 3,
        mean: 4,
        median: 4,
        min: 2,
        max: 6,
        sum: 12,
      });
      expect(x.std).toBeCloseTo(1.632993, 4);
    });

    it('builds a bar chart of column means', () => {
      const results = analyzeDataset({
        columns: ['x', 'y'],
        rows: [[1, 100], [3, 300]],
      });
      expect(results.chart.type).toBe('bar');
      expect(results.chart.categories).toEqual(['x', 'y']);
      expect(results.chart.values).toEqual([2, 200]);
    });

    it('computes an even-count median as the average of the middle two', () => {
      const results = analyzeDataset({
        columns: ['x'],
        rows: [[1], [2], [3], [4]],
      });
      expect(results.stats[0].median).toBe(2.5);
    });
  });
});
