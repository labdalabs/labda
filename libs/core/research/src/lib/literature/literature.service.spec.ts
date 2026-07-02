import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  DB_CONNECTION,
  EventBusService,
  QueueService,
  SUPABASE_ADMIN,
} from '@labda/core-common';
import {
  mockDbConnection,
  mockEventBusService,
  mockQueueService,
  mockSupabaseClient,
} from '@labda/core-common/testing';
import type { AuthenticatedUser } from '@labda/core-common';
import { ReferenceAttachedEvent } from '../research.events';
import { EmbeddingService } from './embedding.service';
import { LiteratureService } from './literature.service';
import { SemanticScholarClient } from './semantic-scholar.client';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'r@lab.test',
  role: 'authenticated',
};

describe('LiteratureService', () => {
  let service: LiteratureService;
  let db: ReturnType<typeof mockDbConnection>;
  let eventBus: ReturnType<typeof mockEventBusService>;
  let queue: ReturnType<typeof mockQueueService>;
  let s2: { search: jest.Mock };
  let module: TestingModule;

  beforeEach(async () => {
    db = mockDbConnection();
    eventBus = mockEventBusService();
    queue = mockQueueService();
    s2 = { search: jest.fn() };
    module = await Test.createTestingModule({
      providers: [
        LiteratureService,
        EmbeddingService,
        { provide: DB_CONNECTION, useValue: db },
        { provide: SUPABASE_ADMIN, useValue: mockSupabaseClient() },
        { provide: EventBusService, useValue: eventBus },
        { provide: QueueService, useValue: queue },
        { provide: SemanticScholarClient, useValue: s2 },
      ],
    }).compile();
    service = module.get(LiteratureService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(service).toBeTruthy();
  });

  describe('searchLiterature', () => {
    it('delegates to Semantic Scholar', async () => {
      s2.search.mockResolvedValueOnce([{ externalId: 'p1', title: 'X' }]);
      const res = await service.searchLiterature(user, { query: 'crispr' });
      expect(s2.search).toHaveBeenCalledWith('crispr', 10);
      expect(res).toHaveLength(1);
    });
  });

  describe('newPapers', () => {
    // The happy path (recency + not-yet-attached filtering) is verified live
    // against a real DB + the Semantic Scholar stub in the e2e/smoke, since the
    // where-terminated queries aren't representable with the shared mock db.
    it('rejects a Project the user does not own', async () => {
      db.limit.mockResolvedValueOnce([]);
      await expect(service.newPapers(user, 'proj-x', 2020)).rejects.toBeTruthy();
    });
  });

  describe('attachReference', () => {
    it('checks hypothesis ownership, inserts, publishes, and enqueues embedding', async () => {
      const now = new Date();
      // ownership check
      db.limit.mockResolvedValueOnce([{ id: 'hyp-1', ownerId: user.id }]);
      db.returning.mockResolvedValueOnce([
        {
          id: 'ref-1',
          hypothesisId: 'hyp-1',
          ownerId: user.id,
          source: 'semantic_scholar',
          externalId: 'p1',
          title: 'A paper',
          authors: ['Ada'],
          year: 2021,
          venue: 'Nature',
          url: 'http://x',
          abstract: null,
          embedding: null,
          createdAt: now,
        },
      ]);

      const res = await service.attachReference(user, {
        hypothesisId: 'hyp-1',
        externalId: 'p1',
        title: 'A paper',
        authors: ['Ada'],
      });

      expect(res).toMatchObject({ id: 'ref-1', title: 'A paper' });
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(ReferenceAttachedEvent),
      );
      expect(queue.send).toHaveBeenCalledWith('reference.embed', {
        referenceId: 'ref-1',
      });
    });

    it('rejects attaching to a hypothesis the user does not own', async () => {
      db.limit.mockResolvedValueOnce([{ id: 'hyp-1', ownerId: 'someone-else' }]);
      await expect(
        service.attachReference(user, {
          hypothesisId: 'hyp-1',
          externalId: 'p1',
          title: 'A paper',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(eventBus.publish).not.toHaveBeenCalled();
      expect(queue.send).not.toHaveBeenCalled();
    });
  });

  describe('embedReference', () => {
    it('computes and stores an embedding for an existing reference', async () => {
      db.limit.mockResolvedValueOnce([
        { id: 'ref-1', title: 'A paper', abstract: 'about crispr' },
      ]);
      await service.embedReference('ref-1');
      expect(db.update).toHaveBeenCalled();
      expect(db.set).toHaveBeenCalled();
    });

    it('no-ops when the reference is gone', async () => {
      db.limit.mockResolvedValueOnce([]);
      await service.embedReference('missing');
      expect(db.update).not.toHaveBeenCalled();
    });
  });
});
