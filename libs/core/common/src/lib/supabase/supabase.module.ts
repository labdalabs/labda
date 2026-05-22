import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from './tokens';

// Shared server-side Supabase client backed by the service-role key. Bypasses
// RLS — never expose this client to user-controlled code paths. Use it for
// Realtime publish/subscribe, Storage, and admin queries on behalf of the API.

@Global()
@Module({
  providers: [
    {
      provide: SUPABASE_ADMIN,
      useFactory: (configService: ConfigService): SupabaseClient => {
        const url = configService.get<string>('supabase.url');
        const serviceRoleKey = configService.get<string>('supabase.serviceRoleKey');
        if (!url || !serviceRoleKey) {
          throw new Error('supabase.url and supabase.serviceRoleKey must be configured');
        }
        return createClient(url, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [SUPABASE_ADMIN],
})
export class SupabaseModule {}
