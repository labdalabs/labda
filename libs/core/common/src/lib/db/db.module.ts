import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { DB_CONNECTION } from './tokens';
import * as schema from './schema';

@Global()
@Module({
  providers: [
    {
      provide: DB_CONNECTION,
      useFactory: (configService: ConfigService) => {
        const raw = configService.get<string>('database.connectionString') ?? '';
        // Supabase's pooler serves a self-signed cert chain and its URL carries
        // an `sslmode` that newer pg-connection-string escalates to
        // `verify-full` (rejecting that chain, so every query throws
        // SELF_SIGNED_CERT_IN_CHAIN). When SSL is needed, strip the query and
        // disable cert verification so TLS still works. Local Postgres (no
        // SSL) is left untouched.
        const sslEnabled =
          !!configService.get('database.ssl') || /sslmode=|supabase/.test(raw);
        const connectionString = sslEnabled ? raw.split('?')[0] : raw;

        const pool = new Pool({
          connectionString,
          max: configService.get('database.max'),
          ssl: sslEnabled ? { rejectUnauthorized: false } : false,
        });

        return drizzle(pool, { schema });
      },
      inject: [ConfigService],
    },
  ],
  exports: [DB_CONNECTION],
})
export class DbModule implements OnApplicationShutdown {
  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema> & { $client: Pool },
  ) {}

  onApplicationShutdown() {
    return this.db.$client.end();
  }
}
