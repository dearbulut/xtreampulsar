export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    url: process.env.DATABASE_URL!,
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  jwt: {
    secret: process.env.JWT_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
  },
  licenseServer: {
    url: process.env.LICENSE_SERVER_URL ?? 'http://localhost:3001',
  },
  server: {
    url: process.env.SERVER_URL ?? 'http://localhost',
    port: parseInt(process.env.SERVER_PORT ?? '8080', 10),
  },
});
