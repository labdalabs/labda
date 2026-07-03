import { buildOkfGraph, neighbours, type GraphInputs } from './okf';

const inputs: GraphInputs = {
  project: { id: 'p1', title: 'Study', description: 'desc' },
  hypotheses: [{ id: 'h1', statement: 'X increases Y' }],
  referencesByHypothesis: {
    h1: [
      { id: 'r1', title: 'Supports', url: 'http://x/1' },
      { id: 'r2', title: 'Contradicts', url: 'http://x/2' },
    ],
  },
  stancesByHypothesis: {
    h1: [
      { referenceId: 'r1', predicate: 'supports', quote: 'X increased Y' },
      { referenceId: 'r2', predicate: 'contradicts', quote: 'X did not increase Y' },
    ],
  },
  protocols: [{ id: 'pr1', title: 'Assay', version: 2 }],
};

describe('okf', () => {
  it('builds nodes for every entity (Project is no longer a node)', () => {
    const g = buildOkfGraph(inputs);
    const types = g.nodes.map((n) => n.type).sort();
    expect(g.format).toBe('okf/1.0');
    // The Project is container context, not a rendered node — no single root.
    expect(g.rootId).toBe('');
    expect(g.nodes.some((n) => n.type === 'Project')).toBe(false);
    expect(types).toEqual([
      'Hypothesis',
      'Protocol',
      'Reference',
      'Reference',
    ]);
  });

  it('builds typed edges: cites, supports, contradicts', () => {
    const g = buildOkfGraph(inputs);
    const preds = new Set(g.edges.map((e) => e.predicate));
    expect(preds).toEqual(new Set(['cites', 'supports', 'contradicts']));
    // grounded stance carries the quote
    const contradiction = g.edges.find((e) => e.predicate === 'contradicts');
    expect(contradiction?.attributes['quote']).toMatch(/did not increase/i);
  });

  it('anchors hypotheses and protocols as their own nodes (no Project edges)', () => {
    const g = buildOkfGraph(inputs);
    expect(g.nodes.some((n) => n.id === 'protocol:pr1')).toBe(true);
    expect(g.edges.some((e) => e.predicate === 'contains')).toBe(false);
  });

  it('neighbours walks the graph from a node', () => {
    const g = buildOkfGraph(inputs);
    const n = neighbours(g, 'hypothesis:h1');
    expect(n.node?.type).toBe('Hypothesis');
    // hypothesis is connected to 2 references (cites) and receives 2 stance
    // edges from those references; the Project is no longer a node.
    const ids = n.neighbours.map((x) => x.id).sort();
    expect(ids).toEqual(['reference:r1', 'reference:r2']);
  });

  it('folds in authored nodes under the node: namespace', () => {
    const g = buildOkfGraph({
      ...inputs,
      authoredNodes: [
        {
          id: 'n1',
          type: 'Idea',
          title: 'A fresh idea',
          content: '# body',
          sourceRef: null,
          attributes: { tag: 'x' },
        },
      ],
    });
    const node = g.nodes.find((n) => n.id === 'node:n1');
    expect(node?.type).toBe('Idea');
    expect(node?.label).toBe('A fresh idea');
    expect(node?.attributes['content']).toBe('# body');
    expect(node?.attributes['tag']).toBe('x');
  });

  it('deduplicates nodes', () => {
    const g = buildOkfGraph({
      ...inputs,
      protocols: [
        { id: 'pr1', title: 'Assay', version: 2 },
        { id: 'pr1', title: 'Assay', version: 2 },
      ],
    });
    expect(g.nodes.filter((n) => n.id === 'protocol:pr1')).toHaveLength(1);
  });

  it('surfaces Notebook, Analysis and Thesis nodes with typed edges', () => {
    const g = buildOkfGraph({
      ...inputs,
      notebooks: [{ protocolId: 'pr1', title: 'Assay — notebook', cells: 3 }],
      analyses: [{ id: 'a1', protocolId: 'pr1', name: 'Yield stats' }],
      theses: [{ id: 't1', title: 'Yield paper draft' }],
    });

    const nb = g.nodes.find((n) => n.id === 'notebook:pr1');
    expect(nb?.type).toBe('Notebook');
    expect(nb?.attributes['cells']).toBe(3);
    expect(
      g.edges.some(
        (e) =>
          e.from === 'protocol:pr1' &&
          e.to === 'notebook:pr1' &&
          e.predicate === 'records',
      ),
    ).toBe(true);

    expect(g.nodes.find((n) => n.id === 'analysis:a1')?.type).toBe('Analysis');
    expect(
      g.edges.some(
        (e) =>
          e.from === 'analysis:a1' &&
          e.to === 'protocol:pr1' &&
          e.predicate === 'analyzes',
      ),
    ).toBe(true);

    expect(g.nodes.find((n) => n.id === 'thesis:t1')?.type).toBe('Thesis');
  });

  it('skips notebooks and analyses whose protocol is not in the graph', () => {
    const g = buildOkfGraph({
      ...inputs,
      notebooks: [{ protocolId: 'ghost', title: 'Orphan', cells: 1 }],
      analyses: [{ id: 'a2', protocolId: 'ghost', name: 'Orphan stats' }],
    });
    expect(g.nodes.some((n) => n.id === 'notebook:ghost')).toBe(false);
    expect(g.nodes.some((n) => n.id === 'analysis:a2')).toBe(false);
  });
});
