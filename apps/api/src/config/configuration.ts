export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'default-secret',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  licenseService: {
    url: process.env.LICENSE_SERVICE_URL ?? 'http://localhost:3001',
  },
});
