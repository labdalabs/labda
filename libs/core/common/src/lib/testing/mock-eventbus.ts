// Drop-in replacement for EventBusService. Verify publishes:
//
//   const bus = mockEventBusService();
//   // ... run code ...
//   expect(bus.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'X' }));

export interface MockEventBusService {
  publish: jest.Mock;
}

export function mockEventBusService(): MockEventBusService {
  return {
    publish: jest.fn().mockResolvedValue(undefined),
  };
}
