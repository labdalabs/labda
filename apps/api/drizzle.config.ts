import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './migrations',
  schema: '../../libs/api/auth/src/lib/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
});
