import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DB_CONNECTION,
  EventBusService,
  SUPABASE_ADMIN,
  analysis,
  profile,
  protocol,
} from '@labda/core-common';
import type { AuthenticatedUser } from '@labda/core-common';
import { AnalysisCreatedEvent } from './analysis.events';
import { analyzeDataset, parseDataset } from './statistics';
import type { AnalysisResults, Dataset } from './statistics';
import { buildAnalysisWorkbook } from './xlsx';
import type {
  AnalysisDto,
  AnalysisExport,
  RunAnalysisInput,
} from './analysis.models';

type AnalysisRow = typeof analysis.$inferSelect;

const EXPORT_BUCKET = 'analysis-exports';
const SIGNED_URL_TTL_SEC = 60 * 60;

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase,
    @Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseClient,
    private readonly eventBusService: EventBusService,
  ) {}

  async runAnalysis(
    user: AuthenticatedUser,
    input: RunAnalysisInput,
  ): Promise<AnalysisDto> {
    await this.assertOwnsProtocol(user, input.protocolId);

    const dataset = parseDataset(input.data);
    const results = analyzeDataset(dataset);

    const created = await this.db.transaction(async (tx) => {
      await tx
        .insert(profile)
        .values({ id: user.id, email: user.email ?? '' })
        .onConflictDoNothing();

      const [row] = await tx
        .insert(analysis)
        .values({
          protocolId: input.protocolId,
          ownerId: user.id,
          name: input.name,
          inputData: dataset as unknown as Record<string, unknown>,
          results: results as unknown as Record<string, unknown>,
        })
        .returning();

      await this.eventBusService.publish(
        new AnalysisCreatedEvent({
          analysisId: row.id,
          protocolId: row.protocolId,
          ownerId: user.id,
          name: row.name,
        }),
      );
      return row;
    });

    this.logger.log(
      { analysisId: created.id, protocolId: created.protocolId },
      `Ran Analysis "${created.name}"`,
    );
    return this.toDto(created);
  }

  async getAnalysis(user: AuthenticatedUser, id: string): Promise<AnalysisDto> {
    return this.toDto(await this.getOwnedRow(user, id));
  }

  async listAnalyses(
    user: AuthenticatedUser,
    protocolId: string,
  ): Promise<AnalysisDto[]> {
    await this.assertOwnsProtocol(user, protocolId);
    const rows = await this.db
      .select()
      .from(analysis)
      .where(eq(analysis.protocolId, protocolId))
      .orderBy(desc(analysis.createdAt));
    return rows.map((row) => this.toDto(row));
  }

  // Generate the `.xlsx` (data + summary + chart), store it in Supabase
  // Storage, and return a short-lived signed URL.
  async exportAnalysis(
    user: AuthenticatedUser,
    id: string,
  ): Promise<AnalysisExport> {
    const row = await this.getOwnedRow(user, id);
    const dataset = row.inputData as unknown as Dataset;
    const results = row.results as unknown as AnalysisResults;

    const buffer = await buildAnalysisWorkbook(row.name, dataset, results);
    const path = `${user.id}/${row.id}.xlsx`;

    const { error: uploadError } = await this.supabase.storage
      .from(EXPORT_BUCKET)
      .upload(path, buffer, {
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
      });
    if (uploadError) {
      this.logger.error('Failed to upload analysis export', { uploadError });
      throw new Error('Failed to store the analysis export');
    }

    const { data: signed, error: signError } = await this.supabase.storage
      .from(EXPORT_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SEC);
    if (signError || !signed) {
      this.logger.error('Failed to sign analysis export URL', { signError });
      throw new Error('Failed to produce a download URL');
    }

    this.logger.log({ analysisId: row.id, path }, 'Exported Analysis to xlsx');
    return { url: signed.signedUrl, path };
  }

  private async getOwnedRow(
    user: AuthenticatedUser,
    id: string,
  ): Promise<AnalysisRow> {
    const [row] = await this.db
      .select()
      .from(analysis)
      .where(and(eq(analysis.id, id), eq(analysis.ownerId, user.id)))
      .limit(1);
    if (!row) {
      throw new NotFoundException('Analysis not found');
    }
    return row;
  }

  private async assertOwnsProtocol(
    user: AuthenticatedUser,
    protocolId: string,
  ): Promise<void> {
    const [row] = await this.db
      .select({ id: protocol.id, ownerId: protocol.ownerId })
      .from(protocol)
      .where(eq(protocol.id, protocolId))
      .limit(1);
    if (!row || row.ownerId !== user.id) {
      throw new NotFoundException('Protocol not found');
    }
  }

  private toDto(row: AnalysisRow): AnalysisDto {
    return {
      id: row.id,
      protocolId: row.protocolId,
      name: row.name,
      inputData: JSON.stringify(row.inputData),
      results: JSON.stringify(row.results),
      createdAt: row.createdAt,
    };
  }
}
