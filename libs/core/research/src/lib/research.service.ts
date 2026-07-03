import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  DB_CONNECTION,
  EventBusService,
  hypothesis,
  profile,
  project,
  projectMember,
} from '@labda/core-common';
import type { AuthenticatedUser } from '@labda/core-common';
import { HypothesisAddedEvent, ProjectCreatedEvent } from './research.events';
import type {
  AddHypothesisInput,
  CreateProjectInput,
  HypothesisDto,
  ProjectDto,
  ProjectMemberDto,
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
    // Projects the user owns or has been granted membership on.
    const memberOf = this.db
      .select({ projectId: projectMember.projectId })
      .from(projectMember)
      .where(eq(projectMember.userId, user.id));
    const rows = await this.db
      .select()
      .from(project)
      .where(
        or(eq(project.ownerId, user.id), inArray(project.id, memberOf)),
      )
      .orderBy(desc(project.createdAt));
    return rows.map((row) => this.toProjectDto(row));
  }

  async getProject(user: AuthenticatedUser, id: string): Promise<ProjectDto> {
    // Access is granted to the owner or any ProjectMember. Gating getProject
    // this way cascades read+write access to every dependent context.
    const memberOf = this.db
      .select({ projectId: projectMember.projectId })
      .from(projectMember)
      .where(eq(projectMember.userId, user.id));
    const [row] = await this.db
      .select()
      .from(project)
      .where(
        and(
          eq(project.id, id),
          or(eq(project.ownerId, user.id), inArray(project.id, memberOf)),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException('Project not found');
    }
    return this.toProjectDto(row);
  }

  async shareProject(
    user: AuthenticatedUser,
    projectId: string,
    email: string,
  ): Promise<ProjectMemberDto> {
    // Only the owner may grant access.
    const [owned] = await this.db
      .select()
      .from(project)
      .where(and(eq(project.id, projectId), eq(project.ownerId, user.id)))
      .limit(1);
    if (!owned) {
      throw new ForbiddenException(
        'Only the project owner can share this project',
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const [invitee] = await this.db
      .select()
      .from(profile)
      .where(eq(sql`lower(${profile.email})`, normalizedEmail))
      .limit(1);
    if (!invitee) {
      throw new NotFoundException('No user with that email');
    }

    await this.db
      .insert(projectMember)
      .values({ projectId, userId: invitee.id, role: 'editor' })
      .onConflictDoNothing();

    this.logger.log(
      { projectId, userId: invitee.id },
      'Shared Project with user',
    );

    return {
      userId: invitee.id,
      email: invitee.email,
      fullName: invitee.fullName ?? null,
      role: 'editor',
    };
  }

  async listMembers(
    user: AuthenticatedUser,
    projectId: string,
  ): Promise<ProjectMemberDto[]> {
    // Access check (owner or member); throws NotFound otherwise.
    await this.getProject(user, projectId);

    const [owned] = await this.db
      .select()
      .from(project)
      .where(eq(project.id, projectId))
      .limit(1);

    const [ownerProfile] = await this.db
      .select()
      .from(profile)
      .where(eq(profile.id, owned.ownerId))
      .limit(1);

    const members = await this.db
      .select({
        userId: profile.id,
        email: profile.email,
        fullName: profile.fullName,
        role: projectMember.role,
      })
      .from(projectMember)
      .innerJoin(profile, eq(profile.id, projectMember.userId))
      .where(eq(projectMember.projectId, projectId))
      .orderBy(desc(projectMember.createdAt));

    const owner: ProjectMemberDto = {
      userId: ownerProfile.id,
      email: ownerProfile.email,
      fullName: ownerProfile.fullName ?? null,
      role: 'owner',
    };

    return [
      owner,
      ...members.map((m) => ({
        userId: m.userId,
        email: m.email,
        fullName: m.fullName ?? null,
        role: m.role,
      })),
    ];
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
    // A hypothesis is reachable in any project the caller can access (owner or
    // shared member) — mirrors getProject membership.
    const memberProjects = this.db
      .select({ projectId: projectMember.projectId })
      .from(projectMember)
      .where(eq(projectMember.userId, user.id));
    const accessibleProjects = this.db
      .select({ id: project.id })
      .from(project)
      .where(
        or(eq(project.ownerId, user.id), inArray(project.id, memberProjects)),
      );
    const [row] = await this.db
      .select()
      .from(hypothesis)
      .where(
        and(
          eq(hypothesis.id, id),
          inArray(hypothesis.projectId, accessibleProjects),
        ),
      )
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
