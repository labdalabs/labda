import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION, agentSession } from '@labda/core-common';
import type { AuthenticatedUser } from '@labda/core-common';
import { ResearchFacade } from './research.facade';
import type {
  AgentSessionDto,
  CreateAgentSessionInput,
  SaveAgentSessionInput,
} from './session.models';

type AgentSessionRow = typeof agentSession.$inferSelect;

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase,
    private readonly researchFacade: ResearchFacade,
  ) {}

  async createSession(
    user: AuthenticatedUser,
    input: CreateAgentSessionInput,
  ): Promise<AgentSessionDto> {
    // Membership gate: owner or member of the parent Project (throws otherwise).
    await this.researchFacade.getProject(user, input.projectId);

    const [row] = await this.db
      .insert(agentSession)
      .values({
        projectId: input.projectId,
        ownerId: user.id,
        goal: input.goal,
        // transcript defaults to [] at the column level.
      })
      .returning();

    this.logger.log(
      { sessionId: row.id, projectId: row.projectId },
      'Created AgentSession',
    );
    return this.toDto(row);
  }

  async listSessions(
    user: AuthenticatedUser,
    projectId: string,
  ): Promise<AgentSessionDto[]> {
    await this.researchFacade.getProject(user, projectId);
    const rows = await this.db
      .select()
      .from(agentSession)
      .where(eq(agentSession.projectId, projectId))
      .orderBy(desc(agentSession.createdAt));
    return rows.map((row) => this.toDto(row));
  }

  async saveSession(
    user: AuthenticatedUser,
    input: SaveAgentSessionInput,
  ): Promise<boolean> {
    const row = await this.loadAccessible(user, input.id);
    await this.db
      .update(agentSession)
      .set({
        transcript: JSON.parse(input.transcript),
        sessionState:
          input.sessionState != null ? JSON.parse(input.sessionState) : null,
        updatedAt: new Date(),
      })
      .where(eq(agentSession.id, row.id));
    return true;
  }

  async deleteSession(
    user: AuthenticatedUser,
    id: string,
  ): Promise<boolean> {
    const row = await this.loadAccessible(user, id);
    await this.db.delete(agentSession).where(eq(agentSession.id, row.id));
    return true;
  }

  // Loads a session and enforces access: the session owner, or an owner/member
  // of the parent Project (researchFacade.getProject throws NotFound otherwise).
  private async loadAccessible(
    user: AuthenticatedUser,
    id: string,
  ): Promise<AgentSessionRow> {
    const [row] = await this.db
      .select()
      .from(agentSession)
      .where(eq(agentSession.id, id))
      .limit(1);
    if (!row) {
      throw new NotFoundException('Agent session not found');
    }
    if (row.ownerId !== user.id) {
      await this.researchFacade.getProject(user, row.projectId);
    }
    return row;
  }

  private toDto(row: AgentSessionRow): AgentSessionDto {
    return {
      id: row.id,
      projectId: row.projectId,
      goal: row.goal,
      // jsonb → JSON string at the boundary; transcript defaults to "[]".
      transcript: JSON.stringify(row.transcript ?? []),
      sessionState:
        row.sessionState != null ? JSON.stringify(row.sessionState) : null,
      createdAt: row.createdAt,
    };
  }
}
