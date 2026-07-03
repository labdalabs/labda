import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  DB_CONNECTION,
  EventBusService,
  profile,
  project,
  projectMember,
  protocol,
  protocolVersion,
} from '@labda/core-common';
import type { AuthenticatedUser } from '@labda/core-common';
import { emptyNotebook, parseNotebook } from './notebook';
import { ProtocolCreatedEvent, ProtocolSavedEvent } from './protocol.events';
import type {
  CreateProtocolInput,
  ProtocolDto,
  SaveProtocolInput,
} from './protocol.models';

type ProtocolRow = typeof protocol.$inferSelect;

@Injectable()
export class ProtocolService {
  private readonly logger = new Logger(ProtocolService.name);

  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase,
    private readonly eventBusService: EventBusService,
  ) {}

  async createProtocol(
    user: AuthenticatedUser,
    input: CreateProtocolInput,
  ): Promise<ProtocolDto> {
    // Ownership: the Project must belong to the caller.
    await this.assertOwnsProject(user, input.projectId);

    // Validate/normalize the notebook (or start empty). Import of an existing
    // `.ipynb` is just createProtocol with its JSON passed here.
    const notebook = input.notebook
      ? parseNotebook(input.notebook)
      : emptyNotebook();

    const created = await this.db.transaction(async (tx) => {
      await tx
        .insert(profile)
        .values({ id: user.id, email: user.email ?? '' })
        .onConflictDoNothing();

      const [row] = await tx
        .insert(protocol)
        .values({
          projectId: input.projectId,
          ownerId: user.id,
          title: input.title,
          notebook,
          version: 1,
        })
        .returning();

      await tx.insert(protocolVersion).values({
        protocolId: row.id,
        version: 1,
        notebook,
      });

      await this.eventBusService.publish(
        new ProtocolCreatedEvent({
          protocolId: row.id,
          projectId: row.projectId,
          ownerId: user.id,
          title: row.title,
        }),
      );
      return row;
    });

    this.logger.log(
      { protocolId: created.id, projectId: created.projectId },
      `Created Protocol "${created.title}"`,
    );
    return this.toDto(created);
  }

  async saveProtocol(
    user: AuthenticatedUser,
    input: SaveProtocolInput,
  ): Promise<ProtocolDto> {
    const existing = await this.getOwnedRow(user, input.id);
    const notebook = parseNotebook(input.notebook);
    const nextVersion = existing.version + 1;

    const saved = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(protocol)
        .set({
          title: input.title ?? existing.title,
          notebook,
          version: nextVersion,
          updatedAt: new Date(),
        })
        .where(eq(protocol.id, input.id))
        .returning();

      await tx.insert(protocolVersion).values({
        protocolId: row.id,
        version: nextVersion,
        notebook,
      });

      await this.eventBusService.publish(
        new ProtocolSavedEvent({
          protocolId: row.id,
          projectId: row.projectId,
          ownerId: user.id,
          version: nextVersion,
        }),
      );
      return row;
    });

    this.logger.log(
      { protocolId: saved.id, version: saved.version },
      'Saved Protocol',
    );
    return this.toDto(saved);
  }

  async getProtocol(user: AuthenticatedUser, id: string): Promise<ProtocolDto> {
    return this.toDto(await this.getOwnedRow(user, id));
  }

  async listProtocols(
    user: AuthenticatedUser,
    projectId: string,
  ): Promise<ProtocolDto[]> {
    await this.assertOwnsProject(user, projectId);
    const rows = await this.db
      .select()
      .from(protocol)
      .where(eq(protocol.projectId, projectId))
      .orderBy(desc(protocol.createdAt));
    return rows.map((row) => this.toDto(row));
  }

  private async getOwnedRow(
    user: AuthenticatedUser,
    id: string,
  ): Promise<ProtocolRow> {
    const [row] = await this.db
      .select()
      .from(protocol)
      .where(and(eq(protocol.id, id), eq(protocol.ownerId, user.id)))
      .limit(1);
    if (!row) {
      throw new NotFoundException('Protocol not found');
    }
    return row;
  }

  private async assertOwnsProject(
    user: AuthenticatedUser,
    projectId: string,
  ): Promise<void> {
    // Owner or a shared member (mirrors research getProject membership).
    const memberOf = this.db
      .select({ projectId: projectMember.projectId })
      .from(projectMember)
      .where(eq(projectMember.userId, user.id));
    const [row] = await this.db
      .select({ id: project.id })
      .from(project)
      .where(
        and(
          eq(project.id, projectId),
          or(eq(project.ownerId, user.id), inArray(project.id, memberOf)),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException('Project not found');
    }
  }

  private toDto(row: ProtocolRow): ProtocolDto {
    return {
      id: row.id,
      projectId: row.projectId,
      title: row.title,
      version: row.version,
      notebook: JSON.stringify(row.notebook),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
