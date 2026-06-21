export type UserStatus = 'ACTIVE' | 'DISABLED' | 'EXPIRED' | 'BANNED';
export type ResellerTier = 'BASIC' | 'SILVER' | 'GOLD' | 'PLATINUM';

export interface User {
  id: string;
  username: string;
  maxConnections: number;
  status: UserStatus;
  expiresAt: Date;
  notes?: string;
  resellerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Reseller {
  id: string;
  username: string;
  email: string;
  credits: number;
  tier: ResellerTier;
  isActive: boolean;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Package {
  id: string;
  name: string;
  durationDays: number;
  maxConnections: number;
  creditCost: number;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Connection {
  id: string;
  ip: string;
  userAgent?: string;
  startedAt: Date;
  endedAt?: Date;
  bytesIn: bigint;
  bytesOut: bigint;
  userId: string;
  streamId: string;
  serverId?: string;
}
