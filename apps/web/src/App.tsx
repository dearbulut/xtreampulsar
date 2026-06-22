import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { Toaster } from 'react-hot-toast';
import { router } from './router';
import { useUiStore } from '@/store/ui.store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1_000 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Keeps the <html> dark class in sync whenever theme changes in the store.
function ThemeSync() {
  const theme = useUiStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeSync />
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
