import { Module, RequestMethod, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { McpModule, McpTransportType } from '@rekog/mcp-nest';
import { CommonModule } from '@labda/core-common';
import { ResearchModule } from '@labda/core-research';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { config, validate } from './configuration';

@Module({
  controllers: [AppController],
  imports: [
    LoggerModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        pinoHttp: {
          level: configService.get('logLevel'),
          transport: configService.get('logPretty')
            ? { target: 'pino-pretty' }
            : undefined,
          genReqId: (req, res) => {
            const id =
              (req.id as string) ?? req.headers['x-request-id'] ?? randomUUID();
            res.setHeader('X-Request-Id', id);
            return id;
          },
        },
        exclude: [{ method: RequestMethod.ALL, path: 'health' }],
      }),
      inject: [ConfigService],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [config],
      validate,
    }),
    McpModule.forRoot({
      name: 'labda',
      version: '1.0.0',
      transport: McpTransportType.STREAMABLE_HTTP,
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      // In-memory schema (not written to disk) so the dev watcher doesn't
      // restart-loop on the generated file.
      autoSchemaFile: true,
      sortSchema: true,
      playground: false,
      path: '/api/graphql',
      context: ({ req }: { req: unknown }) => ({ req }),
    }),
    CommonModule,
    ResearchModule,
  ],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    },
  ],
})
export class AppModule {}
