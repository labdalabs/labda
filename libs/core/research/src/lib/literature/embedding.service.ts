import { Injectable } from '@nestjs/common';
import { REFERENCE_EMBEDDING_DIM } from '@labda/core-common';

// Local, dependency-free embedding via feature hashing over token bigrams,
// L2-normalized. Deterministic and offline — good enough for v0 semantic
// grouping of References without a hosted embedding model. Swap this class for
// a hosted-model client (same interface) when embedding quality matters; the
// pgmq worker and the vector column dimension are the only coupling points.
@Injectable()
export class EmbeddingService {
  readonly dimensions = REFERENCE_EMBEDDING_DIM;

  embed(text: string): number[] {
    const vec = new Array<number>(this.dimensions).fill(0);
    const tokens = this.tokenize(text);
    if (tokens.length === 0) return vec;

    for (let i = 0; i < tokens.length; i++) {
      this.add(vec, tokens[i], 1);
      if (i + 1 < tokens.length) {
        this.add(vec, `${tokens[i]}_${tokens[i + 1]}`, 0.5);
      }
    }

    // L2 normalize so cosine distance is meaningful.
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    if (norm === 0) return vec;
    return vec.map((v) => v / norm);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }

  private add(vec: number[], token: string, weight: number): void {
    const h = this.hash(token);
    const idx = h % this.dimensions;
    // Sign hashing reduces collisions cancelling systematically.
    const sign = ((h >>> 16) & 1) === 0 ? 1 : -1;
    vec[idx] += sign * weight;
  }

  // FNV-1a 32-bit.
  private hash(str: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }
}
