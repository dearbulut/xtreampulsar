export type StreamStatus = 'ONLINE' | 'OFFLINE' | 'BUFFERING' | 'ERROR';
export type CategoryType = 'LIVE' | 'VOD' | 'SERIES';

export interface Stream {
  id: string;
  name: string;
  primaryUrl: string;
  backupUrl?: string;
  ffmpegPid?: number;
  status: StreamStatus;
  tvgId?: string;
  tvgLogo?: string;
  sortOrder: number;
  isActive: boolean;
  categoryId: string;
  serverId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  sortOrder: number;
  isActive: boolean;
  bouquetId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Bouquet {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EPGSource {
  id: string;
  name: string;
  xmltvUrl: string;
  lastParsed?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EPGMapping {
  id: string;
  streamId: string;
  epgChannelId: string;
  epgSourceId: string;
  createdAt: Date;
  updatedAt: Date;
}
