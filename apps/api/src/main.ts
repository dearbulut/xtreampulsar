import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger, RequestMethod } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  app.enableCors();

  // Reseller logos and other uploads served as static files
  app.useStaticAssets('/opt/xtreampulsar/uploads', { prefix: '/uploads' });

  // Xtream Codes API routes stay at root, not under global prefix
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'player_api.php', method: RequestMethod.ALL },
      { path: 'get.php', method: RequestMethod.ALL },
      { path: 'live/:username/:password/:streamId', method: RequestMethod.ALL },
      { path: 'movie/:username/:password/:streamId', method: RequestMethod.ALL },
      { path: 'series/:username/:password/:streamId', method: RequestMethod.ALL },
      { path: 'hls/:streamId/:segment', method: RequestMethod.GET },
      { path: 'stalker/server/load.php', method: RequestMethod.GET },
      { path: 'stalker/portal.php', method: RequestMethod.ALL },
      { path: 'stalker/server/api', method: RequestMethod.GET },
      { path: 'playlist/:token', method: RequestMethod.GET },
      { path: 'playlist/:token/info', method: RequestMethod.GET },
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`XtreamPulsar API running on port ${port}`);
  logger.log(
    `Xtream Codes API: /player_api.php | /get.php | /live | /movie | /series`,
  );
}

bootstrap();
