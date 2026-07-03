import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app/app.module';

declare const module: {
  hot: { accept: () => void; dispose: (callback: () => void) => void };
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  const logger = app.get(Logger);
  const configService = app.get(ConfigService);

  app.use(helmet());
  app.useLogger(logger);
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  if (configService.get('cors.enabled')) {
    app.enableCors({
      origin: configService.get('cors.origin'),
      credentials: true,
    });
  }

  const port = configService.get<number>('port');
  await app.listen(port);

  logger.log(`Application running on http://localhost:${port}/api`);

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}

bootstrap();
