import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DB_CONNECTION, EventBusService } from '@labda/core-common';
import { mockDbConnection, mockEventBusService } from '@labda/core-common/testing';
import type { AuthenticatedUser } from '@labda/core-common';
import { ProtocolCreatedEvent, ProtocolSavedEvent } from './protocol.events';
import { ProtocolService } from './protocol.service';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'r@lab.test',
  role: 'authenticated',
};

const sampleNotebook = JSON.stringify({
  nbformat: 4,
  nbformat_minor: 5,
  metadata: {},
  cells: [{ cell_type: 'code', source: "print('hi')", metadata: {}, outputs: [] }],
});

describe('ProtocolService', () => {
  let service: ProtocolService;
  let db: ReturnType<typeof mockDbConnection>;
  let eventBus: ReturnType<typeof mockEventBusService>;
  let module: TestingModule;

  beforeEach(async () => {
    db = mockDbConnection();
    eventBus = mockEventBusService();
    module = await Test.createTestingModule({
      providers: [
        ProtocolService,
        { provide: DB_CONNECTION, useValue: db },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();
    service = module.get(ProtocolService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(service).toBeTruthy();
  });

  describe('createProtocol', () => {
    it('creates a Protocol with an empty notebook and publishes ProtocolCreated', async () => {
      const now = new Date();
      db.limit.mockResolvedValueOnce([{ id: 'proj-1', ownerId: user.id }]); // project ownership
      db.returning.mockResolvedValueOnce([
        {
          id: 'prot-1',
          projectId: 'proj-1',
          ownerId: user.id,
          title: 'My Protocol',
          notebook: { nbformat: 4, cells: [] },
          version: 1,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const res = await service.createProtocol(user, {
        projectId: 'proj-1',
        title: 'My Protocol',
      });

      expect(res).toMatchObject({ id: 'prot-1', version: 1 });
      expect(typeof res.notebook).toBe('string');
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(ProtocolCreatedEvent),
      );
    });

    it('rejects an invalid imported notebook', async () => {
      db.limit.mockResolvedValueOnce([{ id: 'proj-1', ownerId: user.id }]);
      await expect(
        service.createProtocol(user, {
          projectId: 'proj-1',
          title: 'Bad',
          notebook: '{"nbformat": 3, "cells": []}',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a Project the user does not own', async () => {
      db.limit.mockResolvedValueOnce([{ id: 'proj-1', ownerId: 'other' }]);
      await expect(
        service.createProtocol(user, { projectId: 'proj-1', title: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('saveProtocol', () => {
    it('increments version, snapshots, and publishes ProtocolSaved', async () => {
      const now = new Date();
      db.limit.mockResolvedValueOnce([
        {
          id: 'prot-1',
          projectId: 'proj-1',
          ownerId: user.id,
          title: 'My Protocol',
          notebook: { nbformat: 4, cells: [] },
          version: 1,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      db.returning.mockResolvedValueOnce([
        {
          id: 'prot-1',
          projectId: 'proj-1',
          ownerId: user.id,
          title: 'My Protocol',
          notebook: JSON.parse(sampleNotebook),
          version: 2,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const res = await service.saveProtocol(user, {
        id: 'prot-1',
        notebook: sampleNotebook,
      });

      expect(res.version).toBe(2);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(ProtocolSavedEvent),
      );
    });

    it('rejects saving a Protocol the user does not own', async () => {
      db.limit.mockResolvedValueOnce([]);
      await expect(
        service.saveProtocol(user, { id: 'nope', notebook: sampleNotebook }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
