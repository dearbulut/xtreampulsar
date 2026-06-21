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

export interface Stream {
  id: string;
  externalId: number;
  name: string;
  primaryUrl: string;
  backupUrl?: string;
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
  createdAt: string;
  updatedAt: string;
  _count?: { connections: number };
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
  _count?: { connections: number };
}

// ─── Reseller ─────────────────────────────────────────────────────────────

export type ResellerTier = 'BASIC' | 'SILVER' | 'GOLD' | 'PLATINUM';

export interface Reseller {
  id: string;
  username: string;
  email: string;
  credits: number;
  tier: ResellerTier;
  isActive: boolean;
  parentId?: string;
  createdAt: string;
  _count?: { users: number };
}

// ─── Connection ───────────────────────────────────────────────────────────

export interface Connection {
  id: string;
  ip: string;
  userAgent?: string;
  startedAt: string;
  endedAt?: string;
  bytesIn: string;
  bytesOut: string;
  userId: string;
  user?: { id: string; username: string };
  streamId: string;
  stream?: { id: string; name: string; status: StreamStatus };
  serverId?: string;
  server?: { id: string; name: string; ip: string };
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
  streams: { total: number; online: number };
  servers: { total: number; online: number };
  connections: { active: number; today: number };
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
