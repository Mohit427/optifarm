/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        green: {
          50: token('green-50'),
          100: token('green-100'),
          500: token('green-500'),
          600: token('green-600'),
          700: token('green-700'),
          900: token('green-900'),
        },
        earth: { 600: token('earth-600') },
        sun: { 400: token('sun-400') },
        water: { 500: token('water-500') },
        danger: { 500: token('danger-500') },
        warn: { 500: token('warn-500') },
        ink: { 900: token('ink-900') },
      },
      fontFamily: {
        sans: [
          '"Noto Sans"',
          '"Noto Sans Tamil"',
          '"Noto Sans Devanagari"',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
      },
      borderRadius: { xl: '12px', '2xl': '16px' },
      boxShadow: {
        soft: '0 4px 20px -6px rgb(20 83 45 / 0.15)',
        lift: '0 12px 32px -10px rgb(20 83 45 / 0.25)',
      },
      minHeight: { tap: '48px' },
      minWidth: { tap: '48px' },
    },
  },
  plugins: [],
};
