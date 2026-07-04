import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: { 500: '#7c3aed', 600: '#6d28d9', 700: '#5b21b6' },
      },
    },
  },
  plugins: [],
};
export default config;
