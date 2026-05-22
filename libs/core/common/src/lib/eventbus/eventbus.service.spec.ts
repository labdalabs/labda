import { Test } from '@nestjs/testing';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { Type } from 'class-transformer';
import { IsString, ValidateNested } from 'class-validator';
import { mockSupabaseClient } from '../testing/mock-supabase';
import { DomainEvent } from './domain-event';
import { EventBusService } from './eventbus.service';
import { SUPABASE_ADMIN } from '../supabase/tokens';
import { DOMAIN_EVENTS_CHANNEL } from './tokens';

class TestPayload {
  @IsString()
  greeting!: string;
}

class GreetingEvent extends DomainEvent<TestPayload> {
  override readonly eventType = 'Greeting';
  @ValidateNested()
  @Type(() => TestPayload)
  override readonly payload: TestPayload;
  constructor(payload: TestPayload) {
    super();
    this.payload = payload;
  }
}

describe('EventBusService', () => {
  let service: EventBusService;
  let supabase: ReturnType<typeof mockSupabaseClient>;

  beforeEach(async () => {
    supabase = mockSupabaseClient();
    const moduleRef = await Test.createTestingModule({
      providers: [
        EventBusService,
        { provide: SUPABASE_ADMIN, useValue: supabase },
        DiscoveryService,
        MetadataScanner,
        Reflector,
        { provide: 'ModulesContainer', useValue: new Map() },
      ],
    }).compile();
    service = moduleRef.get(EventBusService);
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('subscribes to the domain-events channel on init', () => {
    expect(supabase.channel).toHaveBeenCalledWith(DOMAIN_EVENTS_CHANNEL);
  });

  it('publishes a validated event as a broadcast', async () => {
    const payload = new TestPayload();
    payload.greeting = 'hi';
    await service.publish(new GreetingEvent(payload));
    const channel = supabase.channel.mock.results[0].value;
    expect(channel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'Greeting',
      payload: expect.objectContaining({
        eventType: 'Greeting',
        payload: expect.objectContaining({ greeting: 'hi' }),
      }),
    });
  });

  it('rejects an event whose payload fails validation', async () => {
    const payload = Object.assign(new TestPayload(), {
      greeting: 123 as unknown as string,
    });
    await expect(service.publish(new GreetingEvent(payload))).rejects.toThrow();
  });
});
