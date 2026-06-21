export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'LICENSE_VALIDATE'
  | 'STREAM_START'
  | 'STREAM_STOP';

export interface AuditLog {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  actorId?: string;
  actorType?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
