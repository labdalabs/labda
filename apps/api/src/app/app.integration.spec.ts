import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  DB_CONNECTION,
  EventBusService,
  QueueService,
  SUPABASE_ADMIN,
} from '@labda/core-common';
import {
  createTestUser,
  mockDbConnection,
  mockEventBusService,
  mockQueueService,
  mockSupabaseClient,
  signTestJwt,
  TEST_JWT_SECRET,
} from '@labda/core-common/testing';
import request from 'supertest';
import { AppModule } from './app.module';

// Integration test boots the real AppModule in-process and swaps every
// external dependency (DB, Supabase admin client, event bus, queue) for a
// mock from `@labda/core-common/testing`. Tests against the HTTP surface
// via supertest — no live Supabase, no server, no network.

describe('API (integration)', () => {
  let app: INestApplication;
  let db: ReturnType<typeof mockDbConnection>;
  let supabase: ReturnType<typeof mockSupabaseClient>;
  let eventBus: ReturnType<typeof mockEventBusService>;
  let queue: ReturnType<typeof mockQueueService>;

  beforeAll(async () => {
    db = mockDbConnection();
    supabase = mockSupabaseClient();
    eventBus = mockEventBusService();
    queue = mockQueueService();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DB_CONNECTION)
      .useValue(db)
      .overrideProvider(SUPABASE_ADMIN)
      .useValue(supabase)
      .overrideProvider(EventBusService)
      .useValue(eventBus)
      .overrideProvider(QueueService)
      .useValue(queue)
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string) => {
          if (key === 'supabase.jwtSecret') return TEST_JWT_SECRET;
          if (key === 'logLevel') return 'silent';
          return undefined;
        },
      })
      .compile();

    app = moduleRef.createNestApplication({ bufferLogs: true });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('public routes', () => {
    it('GET /api is accessible without auth', async () => {
      const res = await request(app.getHttpServer()).get('/api');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Hello API' });
    });

    it('GET /api/health is accessible without auth', async () => {
      const res = await request(app.getHttpServer()).get('/api/health');
      expect(res.status).toBe(200);
    });
  });

  describe('authenticated routes', () => {
    it('GET /api/me without token returns 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/me');
      expect(res.status).toBe(401);
    });

    it('GET /api/me with a signed test JWT returns the user', async () => {
      const user = createTestUser({ email: 'alice@example.com', role: 'admin' });
      const token = signTestJwt(user);

      const res = await request(app.getHttpServer())
        .get('/api/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: user.id,
        email: user.email,
        role: user.role,
      });
    });
  });
});
