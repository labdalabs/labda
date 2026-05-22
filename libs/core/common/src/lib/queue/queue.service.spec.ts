import { Test } from '@nestjs/testing';
import { DB_CONNECTION } from '../db/tokens';
import { mockDbConnection } from '../testing/mock-db';
import { QueueService } from './queue.service';

describe('QueueService', () => {
  let service: QueueService;
  let db: ReturnType<typeof mockDbConnection>;

  beforeEach(async () => {
    db = mockDbConnection();
    const moduleRef = await Test.createTestingModule({
      providers: [QueueService, { provide: DB_CONNECTION, useValue: db }],
    }).compile();
    service = moduleRef.get(QueueService);
  });

  it('send returns the pgmq msg_id', async () => {
    db.execute.mockResolvedValueOnce({ rows: [{ send: BigInt(42) }] });
    const id = await service.send('user.welcome-email', { userId: 'u1' });
    expect(id).toBe(BigInt(42));
    expect(db.execute).toHaveBeenCalled();
  });

  it('send throws when pgmq returns no row', async () => {
    db.execute.mockResolvedValueOnce({ rows: [] });
    await expect(service.send('x', {})).rejects.toThrow(/pgmq\.send/);
  });

  it('sendBatch short-circuits on empty input', async () => {
    const ids = await service.sendBatch('x', []);
    expect(ids).toEqual([]);
    expect(db.execute).not.toHaveBeenCalled();
  });
});
