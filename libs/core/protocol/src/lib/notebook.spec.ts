import { BadRequestException } from '@nestjs/common';
import { emptyNotebook, parseNotebook } from './notebook';

describe('notebook', () => {
  it('emptyNotebook is a valid nbformat-4 doc', () => {
    const nb = emptyNotebook();
    expect(nb.nbformat).toBe(4);
    expect(Array.isArray(nb.cells)).toBe(true);
  });

  it('round-trips an .ipynb losslessly through parseNotebook', () => {
    const original = {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: { kernelspec: { name: 'python3' } },
      cells: [
        { cell_type: 'markdown', source: '# Title', metadata: {} },
        {
          cell_type: 'code',
          source: "print('x')",
          metadata: {},
          outputs: [],
          execution_count: null,
        },
      ],
      custom_top_level: { keep: true },
    };
    const parsed = parseNotebook(JSON.stringify(original));
    expect(parsed).toEqual(original);
  });

  it('accepts an object as well as a JSON string', () => {
    const obj = { nbformat: 4, nbformat_minor: 5, metadata: {}, cells: [] };
    expect(parseNotebook(obj).cells).toEqual([]);
  });

  it('rejects non-nbformat-4 notebooks', () => {
    expect(() =>
      parseNotebook('{"nbformat":3,"cells":[]}'),
    ).toThrow(BadRequestException);
  });

  it('rejects a notebook without a cells array', () => {
    expect(() => parseNotebook('{"nbformat":4}')).toThrow(BadRequestException);
  });

  it('rejects invalid JSON', () => {
    expect(() => parseNotebook('not json')).toThrow(BadRequestException);
  });

  it('rejects a cell with an unknown type', () => {
    expect(() =>
      parseNotebook(
        JSON.stringify({ nbformat: 4, cells: [{ cell_type: 'weird' }] }),
      ),
    ).toThrow(BadRequestException);
  });
});
