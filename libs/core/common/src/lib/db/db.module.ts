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
        const pool = new Pool({
          connectionString: configService.get('database.connectionString'),
          max: configService.get('database.max'),
          ssl: configService.get('database.ssl') ? { rejectUnauthorized: false } : false,
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
