import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger, RequestMethod } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

// Prisma BigInt alanlarini JSON'a string olarak ver (aksi halde JSON.stringify
// "Do not know how to serialize a BigInt" ile patlar — indirme/baglanti byte alanlari).
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (this: bigint): string {
  return this.toString();
};

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.enableCors({
    origin: (origin, callback) => {
      const defaultOrigins = [
        'https://panel.xtreampulsar.com',
        'https://xtreampulsar.com',
        'https://www.xtreampulsar.com',
        'https://control.xtreampulsar.com',
      ];
      const envOrigins = (process.env.CORS_ORIGINS ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const allowedOrigins = [...defaultOrigins, ...envOrigins];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // İzinsiz origin: hata fırlatma (isteği düşürmez) — yalnız CORS başlığı
        // eklenmez. Public widget uçları kendi Access-Control-Allow-Origin:* başlığını
        // ayrı olarak set eder (embed cross-origin çalışsın diye). Header-tabanlı auth
        // olduğundan bu güvenli.
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  });

  // Reseller logos and other uploads served as static files
  app.useStaticAssets('/opt/xtreampulsar/uploads', { prefix: '/uploads' });

  // Xtream Codes API routes stay at root, not under global prefix
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'player_api.php', method: RequestMethod.ALL },
      { path: 'get.php', method: RequestMethod.ALL },
      { path: 'live/:username/:password/:streamId', method: RequestMethod.ALL },
      // PROXY alt-istekleri (variant/media playlist + segment) — liveProxySub route'u.
      { path: 'live/:username/:password/:streamId/*', method: RequestMethod.ALL },
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
