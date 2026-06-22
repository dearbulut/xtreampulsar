import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type ThemeName, applyTheme } from '@/styles/themes';

interface UiState {
  sidebarCollapsed: boolean;
  sidebarOpen: boolean;
  theme: ThemeName;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  setSidebarOpen: (v: boolean) => void;
  toggleTheme: () => void;
  setTheme: (t: ThemeName) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      sidebarOpen: false,
      theme: 'dark',
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setSidebarOpen: (v) => set({ sidebarOpen: v }),
      toggleTheme: () =>
        set((s) => {
          const next: ThemeName = s.theme === 'light' ? 'dark' : 'light';
          applyTheme(next);
          return { theme: next };
        }),
      setTheme: (t) => {
        applyTheme(t);
        set({ theme: t });
      },
    }),
    {
      name: 'xp-ui',
      onRehydrateStorage: () => (state) => {
        if (state?.theme) applyTheme(state.theme);
      },
    },
  ),
);
