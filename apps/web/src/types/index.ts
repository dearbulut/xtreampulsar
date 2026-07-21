export interface AuthUser {
  id: string;
  username: string;
  role: 'ADMIN' | 'RESELLER' | 'USER';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// ─── Stream ────────────────────────────────────────────────────────────────

export type StreamStatus = 'ONLINE' | 'OFFLINE' | 'BUFFERING' | 'ERROR';
export type WorkerStatus = 'IDLE' | 'RUNNING' | 'CRASHED' | 'STOPPED';

export type HealthStatus = 'HEALTHY' | 'UNHEALTHY' | 'UNKNOWN';

export interface Stream {
  id: string;
  externalId: number;
  name: string;
  primaryUrl: string;
  backupUrl?: string;
  backupUrls?: string[];
  streamMode: 'PROXY' | 'TRANSCODE' | 'LOOP';
  loopSources?: string[];
  loopShuffle?: boolean;
  status: StreamStatus;
  workerStatus: WorkerStatus;
  restartCount: number;
  tvgId?: string;
  tvgLogo?: string;
  sortOrder: number;
  isActive: boolean;
  categoryId: string;
  category?: { id: string; name: string; type: string };
  serverId?: string;
  server?: { id: string; name: string; ip: string };
  lastHealthCheck?: string;
  healthStatus?: HealthStatus;
  uptimePercent?: number;
  qualityScore?: string;
  resolution?: string;
  videoBitrate?: number;
  videoCodec?: string;
  fps?: number;
  lastAnalyzedAt?: string;
  tmdbId?: number;
  overview?: string;
  posterUrl?: string;
  backdropUrl?: string;
  releaseYear?: number;
  tmdbRating?: number;
  tmdbGenres?: string[];
  createdAt: string;
  updatedAt: string;
  _count?: { connections: number };
}

export interface Episode {
  id: string;
  externalId: number;
  seriesId: string;
  season: number;
  episode: number;
  title?: string | null;
  primaryUrl: string;
  containerExtension: string;
  plot?: string | null;
  durationSecs?: number | null;
  tmdbRating?: number | null;
  releaseDate?: string | null;
  cover?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── User ─────────────────────────────────────────────────────────────────

export type UserStatus = 'ACTIVE' | 'DISABLED' | 'EXPIRED' | 'BANNED';
export type UserRole = 'ADMIN' | 'RESELLER' | 'USER';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  maxConnections: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  resellerId?: string;
  notes?: string;
  isTrial?: boolean;
  trialEndsAt?: string | null;
  plainPassword?: string | null;
  allowedIps?: string[];
  allowedCountries?: string[];
  blockVpn?: boolean;
  lockDevice?: boolean;
  _count?: { connections: number };
}

// ─── MagDevice ────────────────────────────────────────────────────────────────

export interface MagDevice {
  id: string;
  mac: string;
  serialNumber?: string | null;
  userId?: string | null;
  user?: { id: string; username: string; status: string } | null;
  lastSeen?: string;
  createdAt: string;
}

// ─── Reseller ─────────────────────────────────────────────────────────────

export type ResellerTier = 'BASIC' | 'SILVER' | 'GOLD' | 'PLATINUM';

export interface Reseller {
  id: string;
  username: string;
  email: string | null;
  credits: number;
  maxUsers: number;
  tier: ResellerTier;
  isActive: boolean;
  parentId?: string | null;
  notes?: string | null;
  createdAt: string;
  _count?: { users: number };
  parent?: { id: string; username: string } | null;
  children?: { id: string; username: string; credits: number; isActive: boolean }[];
}

// ─── Connection ───────────────────────────────────────────────────────────

export interface Connection {
  id: string;
  userId: string;
  streamId: string;
  username: string;
  streamName: string;
  streamType: 'LIVE' | 'VOD' | 'SERIES';
  ip: string;
  userAgent?: string;
  startedAt: string;
  updatedAt: string;
  bytesIn: string;
  bytesOut: string;
  duration: number;
}

// ─── Server ───────────────────────────────────────────────────────────────

export interface Server {
  id: string;
  name: string;
  ip: string;
  port: number;
  role: 'MAIN' | 'LOAD_BALANCER';
  status: 'ONLINE' | 'OFFLINE';
  maxClients: number;
  currentClients: number;
  isOnline: boolean;
  location?: string;
  lastCheckedAt?: string;
  responseTime?: number;
  activeConnections?: number;
  utilization?: number;
}


// ─── Analytics ────────────────────────────────────────────────────────────

export interface DashboardData {
  users: { total: number; active: number };
  streams: { total: number; online: number; offline: number; idle: number };
  servers: { total: number; online: number };
  connections: { active: number; today: number };
  activeStreams?: number;
  bandwidthMbps?: number;
}

export interface BandwidthPoint {
  hour: string;
  bytesIn: string;
  bytesOut: string;
}

// ─── Package ──────────────────────────────────────────────────────────────

export interface Package {
  id: string;
  name: string;
  durationDays: number;
  maxConnections: number;
  creditCost: number;
  price: number;
  description?: string;
  isActive: boolean;
  isPublic?: boolean;
  createdAt: string;
  _count?: { users: number };
  bouquets?: { id: string; name: string }[];
}

// ─── Webhook ─────────────────────────────────────────────────────────────

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret?: string | null;
  events: string[];
  isActive: boolean;
  lastTriggered?: string | null;
  lastStatus?: number | null;
  createdAt: string;
}

// ─── EPG ─────────────────────────────────────────────────────────────────

export interface EPGSource {
  id: string;
  name: string;
  xmltvUrl: string;
  lastParsed?: string;
  daysToKeep: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}
