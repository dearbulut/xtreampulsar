/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#dbe4ff',
          500: '#4c6ef5',
          600: '#4263eb',
          700: '#3b5bdb',
          900: '#1e3a8a',
        },
      },
    },
  },
  plugins: [],
};
