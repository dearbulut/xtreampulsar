export * from './license';
export * from './server';
export * from './stream';
export * from './user';
export * from './audit';

export interface ApiResponse<T = unknown> {
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
