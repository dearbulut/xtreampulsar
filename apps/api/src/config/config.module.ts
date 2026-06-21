import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { z } from 'zod';
import configuration from './configuration';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'staging', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  LICENSE_SERVER_URL: z.string().url().default('http://localhost:3001'),
  SERVER_URL: z.string().url().default('http://localhost'),
  SERVER_PORT: z.coerce.number().int().positive().default(8080),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: (config: Record<string, unknown>) => {
        const result = envSchema.safeParse(config);
        if (!result.success) {
          throw new Error(
            `Config validation failed:\n${result.error.issues
              .map((i) => `  ${i.path.join('.')}: ${i.message}`)
              .join('\n')}`,
          );
        }
        return result.data;
      },
    }),
  ],
})
export class AppConfigModule {}
