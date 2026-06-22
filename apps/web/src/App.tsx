import { useEffect } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { Toaster } from 'react-hot-toast';
import { router } from './router';
import { useUiStore } from '@/store/ui.store';
import api from '@/lib/axios';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1_000 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ThemeSync() {
  const theme = useUiStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  return null;
}

interface WhiteLabelConfig {
  panelName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string | null;
}

function WhiteLabelSync() {
  const { data: config } = useQuery<WhiteLabelConfig | null>({
    queryKey: ['white-label'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: WhiteLabelConfig | null }>('/white-label/config');
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (!config) return;
    if (config.primaryColor) {
      document.documentElement.style.setProperty('--color-primary', config.primaryColor);
    }
    if (config.secondaryColor) {
      document.documentElement.style.setProperty('--color-secondary', config.secondaryColor);
    }
    if (config.panelName) {
      document.title = config.panelName;
    }
  }, [config]);

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeSync />
      <WhiteLabelSync />
      <RouterProvider router={router} />
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'var(--color-surface)',
            color: 'var(--color-fg)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            fontSize: '13px',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: 'var(--color-surface)' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: 'var(--color-surface)' },
          },
        }}
      />
    </QueryClientProvider>
  );
}
