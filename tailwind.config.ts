import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        day: '#fcf2e3',
        night: '#212122',
        sunshine: '#ffcc12',
        earth: '#dd6945',
        forest: '#195e47',
        sky: '#85d1e3',
      },
      fontFamily: {
        sans: ['var(--font-geist)', 'sans-serif'],
        serif: ['var(--font-inria)', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
