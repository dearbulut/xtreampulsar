export type ThemeName = 'dark' | 'light' | 'midnight' | 'ocean' | 'forest' | 'sunset';

export interface ThemeVars {
  bg: string;
  surface1: string;
  surface2: string;
  border: string;
  primary: string;
  primaryFg: string;
  sidebar: string;
  text: string;
  muted: string;
}

export const THEMES: Record<ThemeName, ThemeVars> = {
  dark: {
    bg: '#111318',
    surface1: '#1a1d27',
    surface2: '#22263a',
    border: '#2a2d3a',
    primary: '#6366f1',
    primaryFg: '#ffffff',
    sidebar: '#0f1117',
    text: '#e2e8f0',
    muted: '#64748b',
  },
  light: {
    bg: '#f4f6fb',
    surface1: '#ffffff',
    surface2: '#f1f5f9',
    border: '#e2e8f0',
    primary: '#6366f1',
    primaryFg: '#ffffff',
    sidebar: '#ffffff',
    text: '#1e293b',
    muted: '#94a3b8',
  },
  midnight: {
    bg: '#000000',
    surface1: '#0d0d0d',
    surface2: '#1a1a1a',
    border: '#262626',
    primary: '#a78bfa',
    primaryFg: '#ffffff',
    sidebar: '#050505',
    text: '#e2e8f0',
    muted: '#525252',
  },
  ocean: {
    bg: '#0a1628',
    surface1: '#0f2044',
    surface2: '#162a55',
    border: '#1e3a6e',
    primary: '#38bdf8',
    primaryFg: '#000000',
    sidebar: '#070f1e',
    text: '#bae6fd',
    muted: '#475569',
  },
  forest: {
    bg: '#0a1a0a',
    surface1: '#0f250f',
    surface2: '#163016',
    border: '#1e441e',
    primary: '#4ade80',
    primaryFg: '#000000',
    sidebar: '#070e07',
    text: '#bbf7d0',
    muted: '#4b5563',
  },
  sunset: {
    bg: '#1a0a00',
    surface1: '#2a1000',
    surface2: '#3a1800',
    border: '#5a2500',
    primary: '#f97316',
    primaryFg: '#ffffff',
    sidebar: '#120600',
    text: '#fed7aa',
    muted: '#78350f',
  },
};

export const THEME_LABELS: Record<ThemeName, string> = {
  dark: 'Karanlık',
  light: 'Aydınlık',
  midnight: 'Gece Yarısı',
  ocean: 'Okyanus',
  forest: 'Orman',
  sunset: 'Gün Batımı',
};

export function applyTheme(name: ThemeName): void {
  const vars = THEMES[name];
  const root = document.documentElement;

  root.style.setProperty('--color-bg', vars.bg);
  root.style.setProperty('--color-surface-1', vars.surface1);
  root.style.setProperty('--color-surface-2', vars.surface2);
  root.style.setProperty('--color-border', vars.border);
  root.style.setProperty('--color-primary', vars.primary);
  root.style.setProperty('--color-primary-fg', vars.primaryFg);
  root.style.setProperty('--color-sidebar', vars.sidebar);
  root.style.setProperty('--color-text', vars.text);
  root.style.setProperty('--color-muted', vars.muted);

  root.classList.toggle('dark', name !== 'light');
}
