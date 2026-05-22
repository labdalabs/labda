import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { SupabaseModule } from '../supabase/supabase.module';
import { EventBusService } from './eventbus.service';

@Global()
@Module({
  imports: [DiscoveryModule, SupabaseModule],
  providers: [EventBusService],
  exports: [EventBusService],
})
export class EventBusModule {}
