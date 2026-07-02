import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  DB_CONNECTION,
  EventBusService,
  hypothesis,
  profile,
  project,
} from '@labda/core-common';
import type { AuthenticatedUser } from '@labda/core-common';
import { HypothesisAddedEvent, ProjectCreatedEvent } from './research.events';
import type {
  AddHypothesisInput,
  CreateProjectInput,
  HypothesisDto,
  ProjectDto,
} from './research.models';

type ProjectRow = typeof project.$inferSelect;
type HypothesisRow = typeof hypothesis.$inferSelect;

@Injectable()
export class ResearchService {
  private readonly logger = new Logger(ResearchService.name);

  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase,
    private readonly eventBusService: EventBusService,
  ) {}

  async createProject(
    user: AuthenticatedUser,
    input: CreateProjectInput,
  ): Promise<ProjectDto> {
    const created = await this.db.transaction(async (tx) => {
      // The auth.users → Profile mirror trigger covers new signups; upsert
      // here keeps the FK satisfied for users that predate the trigger.
      await tx
        .insert(profile)
        .values({ id: user.id, email: user.email ?? '' })
        .onConflictDoNothing();

      const [row] = await tx
        .insert(project)
        .values({
          ownerId: user.id,
          title: input.title,
          description: input.description ?? null,
        })
        .returning();

      await this.eventBusService.publish(
        new ProjectCreatedEvent({
          projectId: row.id,
          ownerId: user.id,
          title: row.title,
        }),
      );
      return row;
    });

    this.logger.log(
      { projectId: created.id, ownerId: user.id },
      `Created Project "${created.title}"`,
    );
    return this.toProjectDto(created);
  }

  async listProjects(user: AuthenticatedUser): Promise<ProjectDto[]> {
    const rows = await this.db
      .select()
      .from(project)
      .where(eq(project.ownerId, user.id))
      .orderBy(desc(project.createdAt));
    return rows.map((row) => this.toProjectDto(row));
  }

  async getProject(user: AuthenticatedUser, id: string): Promise<ProjectDto> {
    const [row] = await this.db
      .select()
      .from(project)
      .where(and(eq(project.id, id), eq(project.ownerId, user.id)))
      .limit(1);
    if (!row) {
      throw new NotFoundException('Project not found');
    }
    return this.toProjectDto(row);
  }

  async addHypothesis(
    user: AuthenticatedUser,
    input: AddHypothesisInput,
  ): Promise<HypothesisDto> {
    // Ownership check doubles as existence check.
    await this.getProject(user, input.projectId);

    const created = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(hypothesis)
        .values({
          projectId: input.projectId,
          ownerId: user.id,
          statement: input.statement,
          rationale: input.rationale ?? null,
        })
        .returning();

      await this.eventBusService.publish(
        new HypothesisAddedEvent({
          hypothesisId: row.id,
          projectId: row.projectId,
          ownerId: user.id,
          statement: row.statement,
          rationale: row.rationale ?? undefined,
        }),
      );
      return row;
    });

    this.logger.log(
      { hypothesisId: created.id, projectId: created.projectId },
      'Added Hypothesis to Project',
    );
    return this.toHypothesisDto(created);
  }

  async listHypotheses(
    user: AuthenticatedUser,
    projectId: string,
  ): Promise<HypothesisDto[]> {
    await this.getProject(user, projectId);
    const rows = await this.db
      .select()
      .from(hypothesis)
      .where(eq(hypothesis.projectId, projectId))
      .orderBy(desc(hypothesis.createdAt));
    return rows.map((row) => this.toHypothesisDto(row));
  }

  async getHypothesis(
    user: AuthenticatedUser,
    id: string,
  ): Promise<HypothesisDto> {
    const [row] = await this.db
      .select()
      .from(hypothesis)
      .where(and(eq(hypothesis.id, id), eq(hypothesis.ownerId, user.id)))
      .limit(1);
    if (!row) {
      throw new NotFoundException('Hypothesis not found');
    }
    return this.toHypothesisDto(row);
  }

  private toProjectDto(row: ProjectRow): ProjectDto {
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toHypothesisDto(row: HypothesisRow): HypothesisDto {
    return {
      id: row.id,
      projectId: row.projectId,
      statement: row.statement,
      rationale: row.rationale ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
