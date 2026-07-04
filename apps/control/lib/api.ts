import axios from 'axios';

// NEXT_PUBLIC_* değişkenleri build-time'da bake edildiğinden,
// docker-compose runtime environment'ı etkisizdir.
// Relative URL kullanarak nginx proxy üzerinden API'ye ulaşıyoruz:
// control.xtreampulsar.com/api/v1/... → nginx → api:3000
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('control_token') : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('control_token');
      localStorage.removeItem('control_admin');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export const controlApi = {
  auth: {
    login: (username: string, password: string) => api.post('/control/auth/login', { username, password }),
    me: () => api.get('/control/auth/me'),
  },
  dashboard: {
    stats: () => api.get('/control/dashboard'),
  },
  customers: {
    list: (params?: { page?: number; limit?: number; search?: string; status?: string }) => api.get('/control/customers', { params }),
    get: (id: string) => api.get(`/control/customers/${id}`),
    create: (data: Record<string, unknown>) => api.post('/control/customers', data),
    update: (id: string, data: Record<string, unknown>) => api.patch(`/control/customers/${id}`, data),
    delete: (id: string) => api.delete(`/control/customers/${id}`),
  },
  licenses: {
    list: (params?: { page?: number; limit?: number; customerId?: string; search?: string; plan?: string; status?: string }) => api.get('/control/licenses', { params }),
    get: (id: string) => api.get(`/control/licenses/${id}`),
    create: (data: Record<string, unknown>) => api.post('/control/licenses', data),
    update: (id: string, data: Record<string, unknown>) => api.patch(`/control/licenses/${id}`, data),
    suspend: (id: string) => api.post(`/control/licenses/${id}/suspend`),
    activate: (id: string) => api.post(`/control/licenses/${id}/activate`),
    delete: (id: string) => api.delete(`/control/licenses/${id}`),
  },
  tickets: {
    list: (params?: { page?: number; limit?: number; status?: string }) => api.get('/control/tickets', { params }),
    get: (id: string) => api.get(`/control/tickets/${id}`),
    create: (data: Record<string, unknown>) => api.post('/control/tickets', data),
    reply: (id: string, content: string) => api.post(`/control/tickets/${id}/reply`, { content }),
    resolve: (id: string) => api.post(`/control/tickets/${id}/resolve`),
    close: (id: string) => api.post(`/control/tickets/${id}/close`),
    update: (id: string, data: Record<string, unknown>) => api.patch(`/control/tickets/${id}`, data),
  },
  invoices: {
    list: (params?: { page?: number; limit?: number; status?: string }) => api.get('/control/invoices', { params }),
    get: (id: string) => api.get(`/control/invoices/${id}`),
    create: (data: Record<string, unknown>) => api.post('/control/invoices', data),
    markPaid: (id: string, stripeId?: string) => api.post(`/control/invoices/${id}/mark-paid`, { stripeId }),
    cancel: (id: string) => api.post(`/control/invoices/${id}/cancel`),
    delete: (id: string) => api.delete(`/control/invoices/${id}`),
  },
};
