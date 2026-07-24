import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

export interface PermissionDef { key: string; labelTr: string; labelEn: string }
export interface PermissionCategory { key: string; labelTr: string; labelEn: string; permissions: PermissionDef[] }

export interface AdminGroup {
  id: string;
  name: string;
  description: string | null;
  isAdmin: boolean;
  isReseller: boolean;
  isBanned: boolean;
  permissions: string[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { users: number };
}

export interface GroupInput {
  name?: string;
  description?: string | null;
  isAdmin?: boolean;
  isReseller?: boolean;
  isBanned?: boolean;
  permissions?: string[];
}

export function usePermissionCatalog() {
  return useQuery({
    queryKey: ['rbac', 'catalog'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PermissionCategory[] }>('/rbac/catalog');
      return res.data.data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useGroups() {
  return useQuery({
    queryKey: ['rbac', 'groups'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: AdminGroup[] }>('/rbac/groups');
      return res.data.data;
    },
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: GroupInput) => api.post('/rbac/groups', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rbac', 'groups'] }); toast.success('Grup oluşturuldu'); },
    onError: () => toast.error('Grup oluşturulamadı'),
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: GroupInput }) => api.patch(`/rbac/groups/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rbac', 'groups'] }); toast.success('Grup güncellendi'); },
    onError: () => toast.error('Güncelleme başarısız'),
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/rbac/groups/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rbac', 'groups'] }); toast.success('Grup silindi'); },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Silme başarısız');
    },
  });
}
