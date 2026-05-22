// Drop-in replacement for QueueService. Counts enqueues:
//
//   const queue = mockQueueService();
//   // ... run code ...
//   expect(queue.send).toHaveBeenCalledWith('user.welcome-email', { userId: '...' });

export interface MockQueueService {
  send: jest.Mock;
  sendBatch: jest.Mock;
}

export function mockQueueService(): MockQueueService {
  return {
    send: jest.fn().mockResolvedValue(BigInt(1)),
    sendBatch: jest.fn().mockResolvedValue([BigInt(1)]),
  };
}
