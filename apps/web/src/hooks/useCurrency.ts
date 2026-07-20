import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import { currencySymbol, formatMoney } from '@/lib/currency';

/**
 * Panel geneli varsayılan para birimini /settings/public'ten okur (hem admin
 * panelleri hem de auth'suz mağaza sayfası kullanabilir). Sonuç önbelleklenir.
 */
export function useCurrency() {
  const { data: code } = useQuery({
    queryKey: ['public-currency'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data?: { currency?: string } }>('/settings/public');
        return res.data?.data?.currency ?? 'TRY';
      } catch {
        return 'TRY';
      }
    },
    staleTime: 5 * 60_000,
  });
  const cur = code ?? 'TRY';
  return {
    code: cur,
    symbol: currencySymbol(cur),
    format: (amount: number) => formatMoney(amount, cur),
  };
}
