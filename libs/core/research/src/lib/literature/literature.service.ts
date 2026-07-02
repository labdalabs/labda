import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  DB_CONNECTION,
  EventBusService,
  QueueService,
  hypothesis,
  reference,
} from '@labda/core-common';
import type { AuthenticatedUser } from '@labda/core-common';
import { ReferenceAttachedEvent } from '../research.events';
import { EmbeddingService } from './embedding.service';
import { SemanticScholarClient } from './semantic-scholar.client';
import type { LiteratureHit } from './semantic-scholar.client';
import {
  REFERENCE_EMBED_QUEUE,
  type AttachReferenceInput,
  type ReferenceDto,
  type ReferenceEmbedJob,
  type SearchLiteratureInput,
} from './literature.models';

type ReferenceRow = typeof reference.$inferSelect;

@Injectable()
export class LiteratureService {
  private readonly logger = new Logger(LiteratureService.name);

  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase,
    private readonly eventBusService: EventBusService,
    private readonly queueService: QueueService,
    private readonly semanticScholar: SemanticScholarClient,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async searchLiterature(
    _user: AuthenticatedUser,
    input: SearchLiteratureInput,
  ): Promise<LiteratureHit[]> {
    return this.semanticScholar.search(input.query, input.limit ?? 10);
  }

  async attachReference(
    user: AuthenticatedUser,
    input: AttachReferenceInput,
  ): Promise<ReferenceDto> {
    // Ownership check: the Hypothesis must belong to the caller.
    await this.assertOwnsHypothesis(user, input.hypothesisId);

    const created = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(reference)
        .values({
          hypothesisId: input.hypothesisId,
          ownerId: user.id,
          source: input.source ?? 'semantic_scholar',
          externalId: input.externalId,
          title: input.title,
          authors: input.authors ?? [],
          year: input.year ?? null,
          venue: input.venue ?? null,
          url: input.url ?? null,
          abstract: input.abstract ?? null,
        })
        .returning();

      await this.eventBusService.publish(
        new ReferenceAttachedEvent({
          referenceId: row.id,
          hypothesisId: row.hypothesisId,
          ownerId: user.id,
          title: row.title,
        }),
      );
      return row;
    });

    // Compute the embedding asynchronously so the UI isn't blocked.
    await this.queueService.send<ReferenceEmbedJob>(REFERENCE_EMBED_QUEUE, {
      referenceId: created.id,
    });

    this.logger.log(
      { referenceId: created.id, hypothesisId: created.hypothesisId },
      `Attached Reference "${created.title}"`,
    );
    return this.toDto(created);
  }

  async listReferences(
    user: AuthenticatedUser,
    hypothesisId: string,
  ): Promise<ReferenceDto[]> {
    await this.assertOwnsHypothesis(user, hypothesisId);
    const rows = await this.db
      .select()
      .from(reference)
      .where(eq(reference.hypothesisId, hypothesisId))
      .orderBy(desc(reference.createdAt));
    return rows.map((row) => this.toDto(row));
  }

  // Invoked by the reference.embed pgmq worker. Computes and stores the
  // embedding vector for a Reference from its title + abstract.
  async embedReference(referenceId: string): Promise<void> {
    const [row] = await this.db
      .select()
      .from(reference)
      .where(eq(reference.id, referenceId))
      .limit(1);
    if (!row) {
      this.logger.warn(`embedReference: Reference ${referenceId} not found`);
      return;
    }

    const text = [row.title, row.abstract].filter(Boolean).join('\n');
    const vec = this.embeddingService.embed(text);
    // pgvector literal: '[v1,v2,...]'
    const literal = `[${vec.join(',')}]`;
    await this.db
      .update(reference)
      .set({ embedding: sql`${literal}::vector` })
      .where(eq(reference.id, referenceId));

    this.logger.debug(`Embedded Reference ${referenceId}`);
  }

  private async assertOwnsHypothesis(
    user: AuthenticatedUser,
    hypothesisId: string,
  ): Promise<void> {
    const [row] = await this.db
      .select({ id: hypothesis.id, ownerId: hypothesis.ownerId })
      .from(hypothesis)
      .where(eq(hypothesis.id, hypothesisId))
      .limit(1);
    if (!row || row.ownerId !== user.id) {
      // Don't distinguish "not found" from "not yours".
      throw new NotFoundException('Hypothesis not found');
    }
  }

  private toDto(row: ReferenceRow): ReferenceDto {
    return {
      id: row.id,
      hypothesisId: row.hypothesisId,
      source: row.source,
      externalId: row.externalId,
      title: row.title,
      authors: row.authors ?? [],
      year: row.year ?? null,
      venue: row.venue ?? null,
      url: row.url ?? null,
      abstract: row.abstract ?? null,
      createdAt: row.createdAt,
    };
  }
}
