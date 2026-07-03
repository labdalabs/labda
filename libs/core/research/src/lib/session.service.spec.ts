import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DB_CONNECTION } from '@labda/core-common';
import { mockDbConnection } from '@labda/core-common/testing';
import type { AuthenticatedUser } from '@labda/core-common';
import { ResearchFacade } from './research.facade';
import { SessionService } from './session.service';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'r@lab.test',
  role: 'authenticated',
};

describe('SessionService', () => {
  let service: SessionService;
  let db: ReturnType<typeof mockDbConnection>;
  let researchFacade: { getProject: jest.Mock };
  let module: TestingModule;

  beforeEach(async () => {
    db = mockDbConnection();
    researchFacade = { getProject: jest.fn().mockResolvedValue({ id: 'proj-1' }) };
    module = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: DB_CONNECTION, useValue: db },
        { provide: ResearchFacade, useValue: researchFacade },
      ],
    }).compile();
    service = module.get(SessionService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(service).toBeTruthy();
  });

  describe('createSession', () => {
    it('gates on project membership then inserts, serializing transcript to a string', async () => {
      const now = new Date();
      db.returning.mockResolvedValueOnce([
        {
          id: 'sess-1',
          projectId: 'proj-1',
          ownerId: user.id,
          goal: 'Draft the protocol',
          transcript: [],
          sessionState: null,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const result = await service.createSession(user, {
        projectId: 'proj-1',
        goal: 'Draft the protocol',
      });

      expect(researchFacade.getProject).toHaveBeenCalledWith(user, 'proj-1');
      expect(result).toMatchObject({
        id: 'sess-1',
        goal: 'Draft the protocol',
        transcript: '[]',
        sessionState: null,
      });
    });

    it('rejects when the caller cannot access the project', async () => {
      researchFacade.getProject.mockRejectedValueOnce(
        new NotFoundException('Project not found'),
      );
      await expect(
        service.createSession(user, { projectId: 'proj-x', goal: 'nope' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('saveSession', () => {
    it('loads the session (owner) and persists transcript + sessionState', async () => {
      const now = new Date();
      db.limit.mockResolvedValueOnce([
        {
          id: 'sess-1',
          projectId: 'proj-1',
          ownerId: user.id,
          goal: 'Draft the protocol',
          transcript: [],
          sessionState: null,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const ok = await service.saveSession(user, {
        id: 'sess-1',
        transcript: '[{"role":"user","content":"hi"}]',
        sessionState: '{"step":1}',
      });

      expect(ok).toBe(true);
      // Owner short-circuits the membership gate.
      expect(researchFacade.getProject).not.toHaveBeenCalled();
    });

    it('rejects a non-owner caller — sessions are private', async () => {
      const now = new Date();
      db.limit.mockResolvedValueOnce([
        {
          id: 'sess-1',
          projectId: 'proj-1',
          ownerId: 'someone-else',
          goal: 'g',
          transcript: [],
          sessionState: null,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      await expect(
        service.saveSession(user, { id: 'sess-1', transcript: '[]' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects invalid JSON transcript with a 400', async () => {
      const now = new Date();
      db.limit.mockResolvedValueOnce([
        {
          id: 'sess-1',
          projectId: 'proj-1',
          ownerId: user.id,
          goal: 'g',
          transcript: [],
          sessionState: null,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      await expect(
        service.saveSession(user, { id: 'sess-1', transcript: 'not-json' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFound when the session is missing', async () => {
      db.limit.mockResolvedValueOnce([]);
      await expect(
        service.saveSession(user, { id: 'nope', transcript: '[]' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deleteSession', () => {
    it('throws NotFound when the session is missing', async () => {
      db.limit.mockResolvedValueOnce([]);
      await expect(service.deleteSession(user, 'nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
