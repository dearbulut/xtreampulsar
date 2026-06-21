export const APP_NAME = 'XtreamPulsar';
export const APP_VERSION = '0.0.1';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const STREAM_PORTS = {
  HTTP: 8080,
  HTTPS: 8443,
  RTMP: 1935,
  HLS: 8080,
} as const;

export const CONNECTION_LIMITS = {
  DEFAULT_MAX: 1,
  TRIAL_MAX: 1,
  STARTER_MAX: 500,
  PROFESSIONAL_MAX: 2000,
  ENTERPRISE_MAX: 10000,
} as const;

export const EPG_DEFAULTS = {
  REFRESH_INTERVAL_HOURS: 12,
  LOOKAHEAD_HOURS: 24,
  LOOKBEHIND_HOURS: 2,
} as const;

export const JWT_DEFAULTS = {
  EXPIRES_IN: '7d',
  ALGORITHM: 'HS256',
} as const;

export const AUDIT_RETENTION_DAYS = 90;

export type AppConfig = {
  nodeEnv: 'development' | 'production' | 'staging' | 'test';
  port: number;
  database: { url: string };
  jwt: { secret: string; expiresIn: string };
  licenseService: { url: string };
};
