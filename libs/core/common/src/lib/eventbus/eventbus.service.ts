import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { validate } from 'class-validator';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/tokens';
import { DomainEvent } from './domain-event';
import { ON_DOMAIN_EVENT_METADATA } from './on-domain-event.decorator';
import { DOMAIN_EVENTS_CHANNEL } from './tokens';

type Handler = (event: DomainEvent) => unknown | Promise<unknown>;

@Injectable()
export class EventBusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventBusService.name);
  private channel?: RealtimeChannel;
  private readonly handlers = new Map<string, Handler[]>();

  constructor(
    @Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseClient,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  async onModuleInit(): Promise<void> {
    this.collectHandlers();
    await this.bindChannel();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.channel) {
      await this.supabase.removeChannel(this.channel);
      this.channel = undefined;
    }
  }

  async publish<T extends DomainEvent>(event: T): Promise<void> {
    // forbidUnknownValues=false lets undecorated events pass through. Opt in
    // to validation per event by declaring class-validator decorators on the
    // payload class plus @ValidateNested + @Type on the event's `payload` field.
    const errors = await validate(event as object, { forbidUnknownValues: false });
    if (errors.length > 0) {
      this.logger.error(`Invalid event payload: ${JSON.stringify(errors)}`);
      throw new BadRequestException('Invalid event payload');
    }

    if (!this.channel) {
      throw new Error('EventBus channel is not initialized yet');
    }

    const status = await this.channel.send({
      type: 'broadcast',
      event: event.eventType,
      payload: { ...event },
    });

    if (status !== 'ok') {
      this.logger.error(`Failed to publish ${event.eventType}: ${status}`);
      throw new Error(`EventBus publish failed: ${status}`);
    }
    this.logger.debug(`Published ${event.eventType}`);
  }

  private collectHandlers(): void {
    const providers = this.discoveryService.getProviders();
    for (const wrapper of providers) {
      const { instance } = wrapper;
      if (!instance || typeof instance !== 'object') continue;
      const prototype = Object.getPrototypeOf(instance);
      if (!prototype) continue;
      this.metadataScanner.getAllMethodNames(prototype).forEach((methodName) => {
        const method = prototype[methodName];
        const eventType = this.reflector.get<string>(ON_DOMAIN_EVENT_METADATA, method);
        if (!eventType) return;
        const bound: Handler = (event) => method.call(instance, event);
        const existing = this.handlers.get(eventType) ?? [];
        existing.push(bound);
        this.handlers.set(eventType, existing);
        this.logger.log(`Registered handler ${wrapper.name}.${methodName} for ${eventType}`);
      });
    }
  }

  private async bindChannel(): Promise<void> {
    this.channel = this.supabase.channel(DOMAIN_EVENTS_CHANNEL);
    for (const eventType of this.handlers.keys()) {
      this.channel.on(
        'broadcast' as never,
        { event: eventType },
        ({ payload }: { payload: DomainEvent }) => {
          this.dispatch(eventType, payload).catch((err) =>
            this.logger.error(`Handler for ${eventType} failed: ${err}`),
          );
        },
      );
    }
    await new Promise<void>((resolve, reject) => {
      this.channel!.subscribe((status, error) => {
        if (status === 'SUBSCRIBED') resolve();
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(error ?? new Error(status));
      });
    });
    this.logger.log(`Subscribed to ${DOMAIN_EVENTS_CHANNEL}`);
  }

  private async dispatch(eventType: string, event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(eventType);
    if (!handlers || handlers.length === 0) return;
    await Promise.all(
      handlers.map(async (handler) => {
        try {
          await handler(event);
        } catch (err) {
          this.logger.error(`Handler for ${eventType} threw: ${err}`);
        }
      }),
    );
  }
}
