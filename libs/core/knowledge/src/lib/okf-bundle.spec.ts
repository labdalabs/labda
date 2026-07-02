import { buildOkfGraph, type GraphInputs } from './okf';
import { toOkfBundle } from './okf-bundle';

const inputs: GraphInputs = {
  project: { id: 'p1', title: 'Yield Study', description: 'CRISPR + yield' },
  hypotheses: [{ id: 'h1', statement: 'CRISPR increases crop yield' }],
  referencesByHypothesis: {
    h1: [{ id: 'r1', title: 'Field trial', url: 'http://x/1' }],
  },
  stancesByHypothesis: {
    h1: [{ referenceId: 'r1', predicate: 'contradicts', quote: 'did not increase yield' }],
  },
  protocols: [{ id: 'pr1', title: 'Assay', version: 1 }],
  notebooks: [{ protocolId: 'pr1', title: 'Assay — notebook', cells: 2 }],
  analyses: [{ id: 'a1', protocolId: 'pr1', name: 'Yield stats' }],
  theses: [{ id: 't1', title: 'Yield paper draft' }],
};

const bundle = toOkfBundle(buildOkfGraph(inputs));
const byPath = new Map(bundle.map((f) => [f.path, f.content]));

function frontmatter(content: string): Record<string, string> {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  const out: Record<string, string> = {};
  if (m) {
    for (const line of m[1].split('\n')) {
      const i = line.indexOf(':');
      if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return out;
}

describe('OKF bundle (to spec)', () => {
  it('produces a directory of markdown files, one concept per file', () => {
    expect(byPath.has('index.md')).toBe(true);
    expect(byPath.has('hypotheses/h1.md')).toBe(true);
    expect(byPath.has('references/r1.md')).toBe(true);
    expect(byPath.has('protocols/pr1.md')).toBe(true);
    expect([...byPath.keys()].every((p) => p.endsWith('.md'))).toBe(true);
  });

  it('every file has YAML frontmatter with the required `type` field', () => {
    for (const content of byPath.values()) {
      expect(content.startsWith('---\n')).toBe(true);
      expect(frontmatter(content)['type']).toBeTruthy();
    }
  });

  it('the Project concept is index.md with type Project', () => {
    expect(frontmatter(byPath.get('index.md')!)['type']).toBe('Project');
  });

  it('a Reference carries its source URL as `resource`', () => {
    expect(frontmatter(byPath.get('references/r1.md')!)['resource']).toBe(
      'http://x/1',
    );
  });

  it('concepts cross-link with markdown links (a graph, not just a tree)', () => {
    const hyp = byPath.get('hypotheses/h1.md')!;
    // links up to the project and across to the reference
    expect(hyp).toMatch(/\]\(\.\.\/index\.md\)/);
    expect(hyp).toMatch(/\]\(\.\.\/references\/r1\.md\)/);
  });

  it('surfaces the grounded stance on the citing hypothesis', () => {
    const hyp = byPath.get('hypotheses/h1.md')!;
    expect(hyp).toMatch(/contradicts/);
    expect(hyp).toMatch(/did not increase yield/);
  });

  it('emits section index.md files for progressive disclosure', () => {
    expect(frontmatter(byPath.get('hypotheses/index.md')!)['type']).toBe('Index');
    expect(byPath.get('references/index.md')).toBeDefined();
  });

  it('emits Notebook, Analysis and Thesis concept files, cross-linked', () => {
    const nb = byPath.get('notebooks/pr1.md')!;
    expect(frontmatter(nb)['type']).toBe('Notebook');
    expect(frontmatter(nb)['cells']).toBe('2');
    expect(nb).toMatch(/\]\(\.\.\/protocols\/pr1\.md\)/);

    const analysis = byPath.get('analyses/a1.md')!;
    expect(frontmatter(analysis)['type']).toBe('Analysis');
    expect(analysis).toMatch(/\]\(\.\.\/protocols\/pr1\.md\)/);

    const thesis = byPath.get('theses/t1.md')!;
    expect(frontmatter(thesis)['type']).toBe('Thesis');
    expect(thesis).toMatch(/\]\(\.\.\/index\.md\)/);

    // The protocol file links back to its notebook and analysis.
    const protocol = byPath.get('protocols/pr1.md')!;
    expect(protocol).toMatch(/\]\(\.\.\/notebooks\/pr1\.md\)/);
    expect(protocol).toMatch(/\]\(\.\.\/analyses\/a1\.md\)/);
  });
});
