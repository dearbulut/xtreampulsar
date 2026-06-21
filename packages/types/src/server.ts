export type ServerRole = 'MAIN' | 'LOAD_BALANCER';

export interface Server {
  id: string;
  name: string;
  ip: string;
  port: number;
  role: ServerRole;
  maxClients: number;
  isOnline: boolean;
  location?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServerStats {
  serverId: string;
  activeConnections: number;
  cpuUsage: number;
  memoryUsage: number;
  networkIn: bigint;
  networkOut: bigint;
}
