/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        m3: {
          surface: '#140e1b',
          'surface-dim': '#0e0813',
          'surface-bright': '#2d2139',
          'surface-container-lowest': '#0a050f',
          'surface-container-low': '#1c1325',
          'surface-container': '#23192f',
          'surface-container-high': '#2e213d',
          'surface-container-highest': '#3a2a4c',
          primary: '#d0bcff',
          'on-primary': '#381e72',
          'primary-container': '#4f378b',
          'on-primary-container': '#e8def8',
          secondary: '#ccc2dc',
          tertiary: '#ffb4a9',
          coral: '#ff8a7a',
          gold: '#e8b73a',
          mint: '#a8f5cc',
          'outline-subtle': '#352945',
          'on-surface': '#e6e0e9',
          'on-surface-variant': '#cac4d0',
        },
      },
      fontFamily: {
        display: ['"Outfit"', '"Google Sans"', 'system-ui', 'sans-serif'],
        sans: ['"DM Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        float: 'float 6s ease-in-out infinite',
        glow: 'glow 3s ease-in-out infinite alternate',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { opacity: '0.4', filter: 'blur(20px)' },
          '100%': { opacity: '0.8', filter: 'blur(30px)' },
        },
      },
    },
  },
  plugins: [],
};
