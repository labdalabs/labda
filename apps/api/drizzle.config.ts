import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './migrations',
  schema: '../../libs/core/common/src/lib/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
});
