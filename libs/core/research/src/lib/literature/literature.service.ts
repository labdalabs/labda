import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DB_CONNECTION,
  EventBusService,
  QueueService,
  SUPABASE_ADMIN,
  hypothesis,
  project,
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
    @Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseClient,
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

  // Daily-digest data (issue #18): recent papers matching a Project's
  // Hypotheses, published in/after `sinceYear`, excluding already-attached
  // References. Owner-scoped.
  async newPapers(
    user: AuthenticatedUser,
    projectId: string,
    sinceYear: number,
  ): Promise<LiteratureHit[]> {
    const [owned] = await this.db
      .select({ id: project.id })
      .from(project)
      .where(and(eq(project.id, projectId), eq(project.ownerId, user.id)))
      .limit(1);
    if (!owned) throw new NotFoundException('Project not found');

    const hyps = await this.db
      .select({ id: hypothesis.id, statement: hypothesis.statement })
      .from(hypothesis)
      .where(eq(hypothesis.projectId, projectId));

    const attached = new Set(
      (
        await this.db
          .select({ externalId: reference.externalId })
          .from(reference)
          .innerJoin(hypothesis, eq(reference.hypothesisId, hypothesis.id))
          .where(eq(hypothesis.projectId, projectId))
      ).map((r) => r.externalId),
    );

    const seen = new Set<string>();
    const out: LiteratureHit[] = [];
    for (const h of hyps) {
      let hits: LiteratureHit[] = [];
      try {
        hits = await this.semanticScholar.search(h.statement, 5);
      } catch (err) {
        this.logger.warn(`newPapers: search failed for ${h.id}: ${err}`);
      }
      for (const hit of hits) {
        if (
          (hit.year ?? 0) >= sinceYear &&
          !attached.has(hit.externalId) &&
          !seen.has(hit.externalId)
        ) {
          seen.add(hit.externalId);
          out.push(hit);
        }
      }
    }
    return out;
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
          openAccessPdfUrl: input.openAccessPdfUrl ?? null,
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

  // Download the Reference's OPEN-ACCESS PDF (only), cache it in Supabase
  // Storage, and return a signed URL. Refuses when no open-access PDF is known —
  // we never fetch from paywall-circumvention sources.
  async downloadPdf(
    user: AuthenticatedUser,
    referenceId: string,
  ): Promise<{ url: string; path: string }> {
    const [row] = await this.db
      .select()
      .from(reference)
      .where(and(eq(reference.id, referenceId), eq(reference.ownerId, user.id)))
      .limit(1);
    if (!row) throw new NotFoundException('Reference not found');
    if (!row.openAccessPdfUrl) {
      throw new BadRequestException(
        'No open-access PDF is available for this Reference',
      );
    }

    let pdf: Buffer;
    try {
      const res = await fetch(row.openAccessPdfUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      pdf = Buffer.from(await res.arrayBuffer());
    } catch (err) {
      this.logger.error('Failed to fetch open-access PDF', { err });
      throw new BadRequestException('Could not fetch the open-access PDF');
    }

    const path = `${user.id}/${row.id}.pdf`;
    const { error: uploadError } = await this.supabase.storage
      .from('reference-pdfs')
      .upload(path, pdf, { contentType: 'application/pdf', upsert: true });
    if (uploadError) {
      throw new Error('Failed to store the PDF');
    }
    const { data: signed, error: signError } = await this.supabase.storage
      .from('reference-pdfs')
      .createSignedUrl(path, 60 * 60);
    if (signError || !signed) throw new Error('Failed to produce a download URL');

    this.logger.log({ referenceId }, 'Cached open-access Reference PDF');
    return { url: signed.signedUrl, path };
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
      openAccessPdfUrl: row.openAccessPdfUrl ?? null,
      createdAt: row.createdAt,
    };
  }
}
