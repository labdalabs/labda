import {
  classifyReference,
  classifyReferences,
  detectHypothesisGaps,
  detectProtocolGaps,
} from './challenge';

describe('challenge engine', () => {
  const hypothesis = 'CRISPR editing increases crop yield.';

  describe('classifyReference', () => {
    it('flags a contradicting Reference with the contradicting quote', () => {
      const f = classifyReference(hypothesis, {
        id: 'ref-1',
        title: 'CRISPR in field trials',
        abstract:
          'In field trials, CRISPR editing did not increase crop yield. No significant effect on yield was observed.',
        url: 'http://example.org/1',
      });
      expect(f).not.toBeNull();
      expect(f!.kind).toBe('contradicts');
      expect(f!.referenceId).toBe('ref-1');
      expect(f!.sourceUrl).toBe('http://example.org/1');
      expect(f!.quote).toMatch(/did not increase crop yield/i);
    });

    it('flags a supporting Reference', () => {
      const f = classifyReference(hypothesis, {
        id: 'ref-2',
        title: 'Yield gains from gene editing',
        abstract:
          'CRISPR editing increased crop yield substantially across sites.',
      });
      expect(f!.kind).toBe('supports');
      expect(f!.quote).toMatch(/increased crop yield/i);
    });

    it('returns null for an unrelated Reference', () => {
      const f = classifyReference(hypothesis, {
        id: 'ref-3',
        title: 'Quantum chromodynamics',
        abstract: 'Lattice gauge theory computations of hadron masses.',
      });
      expect(f).toBeNull();
    });
  });

  it('classifyReferences keeps only grounded findings', () => {
    const findings = classifyReferences(hypothesis, [
      { id: 'a', title: 'CRISPR reduced yield', abstract: 'CRISPR reduced crop yield.' },
      { id: 'b', title: 'Unrelated', abstract: 'Something about astronomy.' },
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0].referenceId).toBe('a');
    expect(findings[0].kind).toBe('contradicts');
  });

  describe('detectHypothesisGaps', () => {
    it('flags a missing control and missing mechanism', () => {
      const gaps = detectHypothesisGaps('CRISPR increases yield.');
      const kinds = gaps.map((g) => g.summary);
      expect(gaps.every((g) => g.kind === 'logic_gap')).toBe(true);
      expect(kinds.some((s) => /control/i.test(s))).toBe(true);
      expect(kinds.some((s) => /mechanism/i.test(s))).toBe(true);
    });

    it('does not flag a control gap when a control is described', () => {
      const gaps = detectHypothesisGaps(
        'CRISPR increases yield compared to a wild-type control because of X.',
      );
      expect(gaps.some((g) => /control/i.test(g.summary))).toBe(false);
    });
  });

  describe('detectProtocolGaps', () => {
    it('flags missing controls / replication / randomization / stats', () => {
      const gaps = detectProtocolGaps('print("grow plants and measure")');
      const kinds = gaps.map((g) => g.summary.toLowerCase());
      expect(gaps.every((g) => g.kind === 'missing_step')).toBe(true);
      expect(kinds.some((s) => s.includes('control'))).toBe(true);
      expect(kinds.some((s) => s.includes('replication'))).toBe(true);
      expect(kinds.some((s) => s.includes('randomization'))).toBe(true);
      expect(kinds.some((s) => s.includes('statistical'))).toBe(true);
    });

    it('is satisfied when the Protocol mentions the elements', () => {
      const gaps = detectProtocolGaps(
        'control group, n=30 replicates, randomized assignment, run a t-test',
      );
      expect(gaps).toHaveLength(0);
    });
  });
});
