import { z } from 'zod';

const configSchema = z.object({
  port: z.number(),
  logLevel: z.string(),
  logPretty: z.boolean(),
  frontendUrl: z.string(),
  cors: z.object({
    enabled: z.boolean(),
    origin: z.array(z.string()),
  }),
  database: z.object({
    connectionString: z.string(),
    max: z.number(),
    ssl: z.boolean(),
  }),
  supabase: z.object({
    url: z.string(),
    serviceRoleKey: z.string(),
    jwtSecret: z.string(),
  }),
  anthropic: z.object({
    apiKey: z.string(),
    model: z.string(),
  }),
  semanticScholar: z.object({
    baseUrl: z.string(),
    apiKey: z.string().optional(),
  }),
});

export const config = () => ({
  port: parseInt(process.env.PORT || '3001', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  logPretty: process.env.LOG_PRETTY === 'true',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  cors: {
    enabled: process.env.CORS_ENABLED !== 'false',
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
  },
  database: {
    connectionString: process.env.DATABASE_URL || '',
    max: parseInt(process.env.DATABASE_MAX || '20', 10),
    ssl: process.env.DATABASE_SSL === 'true',
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    jwtSecret: process.env.SUPABASE_JWT_SECRET || '',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
  },
  semanticScholar: {
    baseUrl:
      process.env.SEMANTIC_SCHOLAR_BASE_URL ||
      'https://api.semanticscholar.org/graph/v1',
    apiKey: process.env.SEMANTIC_SCHOLAR_API_KEY || undefined,
  },
});

export function validate() {
  const result = configSchema.safeParse(config());
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.data;
}
