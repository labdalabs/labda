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
  it('builds nodes for every entity', () => {
    const g = buildOkfGraph(inputs);
    const types = g.nodes.map((n) => n.type).sort();
    expect(g.format).toBe('okf/1.0');
    expect(g.rootId).toBe('project:p1');
    expect(types).toEqual([
      'Hypothesis',
      'Project',
      'Protocol',
      'Reference',
      'Reference',
    ]);
  });

  it('builds typed edges: contains, cites, supports, contradicts', () => {
    const g = buildOkfGraph(inputs);
    const preds = new Set(g.edges.map((e) => e.predicate));
    expect(preds).toEqual(new Set(['contains', 'cites', 'supports', 'contradicts']));
    // grounded stance carries the quote
    const contradiction = g.edges.find((e) => e.predicate === 'contradicts');
    expect(contradiction?.attributes['quote']).toMatch(/did not increase/i);
  });

  it('connects the Project to the Protocol via contains', () => {
    const g = buildOkfGraph(inputs);
    expect(
      g.edges.some(
        (e) => e.from === 'project:p1' && e.to === 'protocol:pr1' && e.predicate === 'contains',
      ),
    ).toBe(true);
  });

  it('neighbours walks the graph from a node', () => {
    const g = buildOkfGraph(inputs);
    const n = neighbours(g, 'hypothesis:h1');
    expect(n.node?.type).toBe('Hypothesis');
    // hypothesis is connected to project (contains), 2 references (cites),
    // and receives 2 stance edges from those references.
    const ids = n.neighbours.map((x) => x.id).sort();
    expect(ids).toEqual(['project:p1', 'reference:r1', 'reference:r2']);
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
});
