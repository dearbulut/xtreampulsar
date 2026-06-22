import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';

interface MonthlyBucket {
  month: string;
  newUsers: number;
  totalRevenue: number;
}

interface ResellerRow {
  resellerId: string;
  username: string;
  tier: string;
  userCount: number;
  estimatedRevenue: number;
}

interface RevenueReport {
  period: { start: string; end: string };
  summary: { totalUsers: number; totalRevenue: number };
  monthly: MonthlyBucket[];
  byReseller: ResellerRow[];
}

export function useRevenueReport(startDate?: string, endDate?: string, resellerId?: string) {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  if (resellerId) params.set('resellerId', resellerId);

  return useQuery<RevenueReport>({
    queryKey: ['revenue-report', startDate, endDate, resellerId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: RevenueReport }>(`/analytics/revenue?${params.toString()}`);
      return res.data.data;
    },
  });
}
