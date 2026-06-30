/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
          hover:   'rgb(var(--color-primary-hover-rgb) / <alpha-value>)',
          light:   'rgb(var(--color-primary-light-rgb) / <alpha-value>)',
          50:      'rgb(var(--color-primary-50-rgb) / <alpha-value>)',
        },
        // Semantic tokens — resolved via CSS custom properties at runtime
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-2': 'var(--color-surface-2)',
        sidebar: 'var(--color-sidebar)',
        border: 'var(--color-border)',
        fg: 'var(--color-fg)',
        muted: 'var(--color-muted)',
        success: {
          DEFAULT: '#10b981',
          bg: 'rgba(16,185,129,0.12)',
        },
        danger: {
          DEFAULT: '#ef4444',
          bg: 'rgba(239,68,68,0.12)',
        },
        warning: {
          DEFAULT: '#f59e0b',
          bg: 'rgba(245,158,11,0.12)',
        },
        info: {
          DEFAULT: '#3b82f6',
          bg: 'rgba(59,130,246,0.12)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideIn: {
          '0%': { transform: 'translateX(-8px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
