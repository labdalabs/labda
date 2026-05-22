// Minimal Supabase admin client mock. Covers the surface used by the template:
// channel().on().subscribe().send(), auth.admin.*, storage.from().upload/download.
//
//   const supabase = mockSupabaseClient();
//   // ... run code ...
//   expect(supabase.channel).toHaveBeenCalledWith('labda:domain-events');
//   const channel = supabase.channel.mock.results[0].value;
//   expect(channel.send).toHaveBeenCalledWith({ type: 'broadcast', event: 'X', payload: ... });

export interface MockRealtimeChannel {
  on: jest.Mock;
  subscribe: jest.Mock;
  send: jest.Mock;
  unsubscribe: jest.Mock;
}

export interface MockSupabaseClient {
  channel: jest.Mock;
  removeChannel: jest.Mock;
  auth: {
    admin: {
      getUserById: jest.Mock;
      createUser: jest.Mock;
      deleteUser: jest.Mock;
      listUsers: jest.Mock;
    };
  };
  storage: {
    from: jest.Mock;
  };
}

export function mockRealtimeChannel(): MockRealtimeChannel {
  const channel = {} as MockRealtimeChannel;
  channel.on = jest.fn().mockReturnValue(channel);
  channel.subscribe = jest.fn((cb?: (status: string, err: unknown) => void) => {
    cb?.('SUBSCRIBED', null);
    return channel;
  });
  channel.send = jest.fn().mockResolvedValue('ok');
  channel.unsubscribe = jest.fn().mockResolvedValue('ok');
  return channel;
}

export function mockSupabaseClient(): MockSupabaseClient {
  return {
    channel: jest.fn(mockRealtimeChannel),
    removeChannel: jest.fn().mockResolvedValue('ok'),
    auth: {
      admin: {
        getUserById: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
        createUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
        deleteUser: jest.fn().mockResolvedValue({ data: null, error: null }),
        listUsers: jest.fn().mockResolvedValue({ data: { users: [] }, error: null }),
      },
    },
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ data: null, error: null }),
        download: jest.fn().mockResolvedValue({ data: null, error: null }),
        createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: '' }, error: null }),
        remove: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    },
  };
}
