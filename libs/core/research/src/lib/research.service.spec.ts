import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DB_CONNECTION, EventBusService } from '@labda/core-common';
import { mockDbConnection, mockEventBusService } from '@labda/core-common/testing';
import type { AuthenticatedUser } from '@labda/core-common';
import { HypothesisAddedEvent, ProjectCreatedEvent } from './research.events';
import { ResearchService } from './research.service';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'r@lab.test',
  role: 'authenticated',
};

describe('ResearchService', () => {
  let service: ResearchService;
  let db: ReturnType<typeof mockDbConnection>;
  let eventBus: ReturnType<typeof mockEventBusService>;
  let module: TestingModule;

  beforeEach(async () => {
    db = mockDbConnection();
    eventBus = mockEventBusService();
    module = await Test.createTestingModule({
      providers: [
        ResearchService,
        { provide: DB_CONNECTION, useValue: db },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();
    service = module.get(ResearchService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(service).toBeTruthy();
  });

  describe('createProject', () => {
    it('inserts a project and publishes ProjectCreated inside the transaction', async () => {
      const now = new Date();
      db.returning.mockResolvedValueOnce([
        {
          id: 'proj-1',
          ownerId: user.id,
          title: 'My Study',
          description: null,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const result = await service.createProject(user, { title: 'My Study' });

      expect(result).toMatchObject({ id: 'proj-1', title: 'My Study' });
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(ProjectCreatedEvent),
      );
      const event = eventBus.publish.mock.calls[0][0] as ProjectCreatedEvent;
      expect(event.payload.projectId).toBe('proj-1');
      expect(event.payload.ownerId).toBe(user.id);
    });
  });

  describe('getProject', () => {
    it('throws NotFound when the project is missing or not owned', async () => {
      db.limit.mockResolvedValueOnce([]);
      await expect(service.getProject(user, 'nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('addHypothesis', () => {
    it('checks project ownership then inserts and publishes HypothesisAdded', async () => {
      const now = new Date();
      // getProject ownership check
      db.limit.mockResolvedValueOnce([
        {
          id: 'proj-1',
          ownerId: user.id,
          title: 'My Study',
          description: null,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      db.returning.mockResolvedValueOnce([
        {
          id: 'hyp-1',
          projectId: 'proj-1',
          ownerId: user.id,
          statement: 'X causes Y',
          rationale: null,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const result = await service.addHypothesis(user, {
        projectId: 'proj-1',
        statement: 'X causes Y',
      });

      expect(result).toMatchObject({ id: 'hyp-1', statement: 'X causes Y' });
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(HypothesisAddedEvent),
      );
    });

    it('rejects adding a hypothesis to a project the user does not own', async () => {
      db.limit.mockResolvedValueOnce([]); // ownership check fails
      await expect(
        service.addHypothesis(user, {
          projectId: 'proj-x',
          statement: 'nope',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });
  });
});
