import { EmbeddingService } from './embedding.service';

describe('EmbeddingService', () => {
  const service = new EmbeddingService();

  it('produces a vector of the configured dimensionality', () => {
    const vec = service.embed('CRISPR gene editing in plants');
    expect(vec).toHaveLength(service.dimensions);
  });

  it('is deterministic for the same input', () => {
    const a = service.embed('mitochondrial dysfunction');
    const b = service.embed('mitochondrial dysfunction');
    expect(a).toEqual(b);
  });

  it('L2-normalizes non-empty text (unit length)', () => {
    const vec = service.embed('protein folding kinetics');
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it('returns a zero vector for empty text', () => {
    const vec = service.embed('   ');
    expect(vec.every((v) => v === 0)).toBe(true);
  });

  it('gives more similar vectors to related text than unrelated', () => {
    const cos = (a: number[], b: number[]) =>
      a.reduce((s, v, i) => s + v * b[i], 0);
    const base = service.embed('gene expression regulation transcription');
    const near = service.embed('regulation of gene expression transcription');
    const far = service.embed('quantum chromodynamics lattice gauge theory');
    expect(cos(base, near)).toBeGreaterThan(cos(base, far));
  });
});
