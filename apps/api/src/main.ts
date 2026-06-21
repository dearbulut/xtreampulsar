import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, RequestMethod } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  app.enableCors();

  // Xtream Codes API routes must stay at root — exclude from global prefix
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'player_api.php', method: RequestMethod.ALL },
      { path: 'get.php', method: RequestMethod.ALL },
      { path: 'live/:username/:password/:streamId', method: RequestMethod.ALL },
      { path: 'movie/:username/:password/:streamId', method: RequestMethod.ALL },
      {
        path: 'series/:username/:password/:streamId',
        method: RequestMethod.ALL,
      },
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

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`XtreamPulsar API running on port ${port}`);
  logger.log(`Xtream Codes API: /player_api.php, /get.php, /live, /movie, /series`);
}

bootstrap();
