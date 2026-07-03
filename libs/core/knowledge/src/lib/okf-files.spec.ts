import type { AuthenticatedUser } from '@labda/core-common';
import { KnowledgeService } from './knowledge.service';
import { buildOkfGraph, type GraphInputs } from './okf';

// okfFiles / okfFile only depend on this.knowledgeGraph (membership-gated), so
// we stub that and exercise the pure file-listing logic.
const inputs: GraphInputs = {
  project: { id: 'p1', title: 'Study', description: null },
  hypotheses: [{ id: 'h1', statement: 'CRISPR increases yield' }],
  referencesByHypothesis: {},
  stancesByHypothesis: {},
  protocols: [],
  authoredNodes: [
    {
      id: 'abc-123',
      type: 'Idea',
      title: 'My idea',
      content: '# hello world',
      sourceRef: null,
    },
  ],
};

const user = { id: 'u1' } as AuthenticatedUser;

function makeService(): KnowledgeService {
  const svc = new KnowledgeService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  jest.spyOn(svc, 'knowledgeGraph').mockResolvedValue(buildOkfGraph(inputs));
  return svc;
}

describe('okf files (browsable bundle)', () => {
  it('marks author-first files editable with the KnowledgeNode id', async () => {
    const files = await makeService().okfFiles(user, 'p1');

    const authored = files.find((f) => f.path === 'nodes/abc-123.md');
    expect(authored).toBeDefined();
    expect(authored!.editable).toBe(true);
    expect(authored!.nodeId).toBe('abc-123');
    expect(authored!.title).toBe('My idea');
    expect(authored!.dir).toBe('nodes');

    // Derived structural files are read-only, with no backing node id.
    const hyp = files.find((f) => f.path === 'hypotheses/h1.md');
    expect(hyp!.editable).toBe(false);
    expect(hyp!.nodeId).toBeNull();

    // index.md files get the directory name (or "Index" at the root).
    expect(files.find((f) => f.path === 'index.md')!.title).toBe('Index');
    expect(files.find((f) => f.path === 'hypotheses/index.md')!.title).toBe(
      'hypotheses',
    );
  });

  it('okfFile returns the markdown content for a path', async () => {
    const file = await makeService().okfFile(user, 'p1', 'nodes/abc-123.md');
    expect(file.path).toBe('nodes/abc-123.md');
    expect(file.content).toContain('# hello world');
  });

  it('okfFile throws NotFound for an unknown path', async () => {
    await expect(makeService().okfFile(user, 'p1', 'nope.md')).rejects.toThrow(
      /No OKF file/,
    );
  });
});
