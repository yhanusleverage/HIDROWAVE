/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'brand-pulse': 'brand-breathe 2.4s ease-in-out infinite',
        'brand-breathe': 'brand-breathe 2.4s ease-in-out infinite',
        'page-enter': 'page-enter 0.35s ease-out',
      },
      keyframes: {
        'brand-breathe': {
          '0%, 100%': {
            transform: 'scale(0.88)',
            filter: 'drop-shadow(0 0 6px rgba(38, 198, 218, 0.35))',
          },
          '50%': {
            transform: 'scale(1.14)',
            filter: 'drop-shadow(0 0 22px rgba(45, 212, 191, 0.9))',
          },
        },
        'page-enter': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      colors: {
        dark: {
          bg: "#0a1628",
          surface: "#0f1e3a",
          card: "#152547",
          border: "#1e3a5f",
          text: "#e0f2fe",
          textSecondary: "#bae6fd",
        },
        aqua: {
          50: "#e0f7fa",
          100: "#b2ebf2",
          200: "#80deea",
          300: "#4dd0e1",
          400: "#26c6da",
          500: "#00bcd4",
          600: "#00acc1",
          700: "#0097a7",
          800: "#00838f",
          900: "#006064",
        },
        primary: {
          50: "#e0f2fe",
          100: "#bae6fd",
          200: "#7dd3fc",
          300: "#38bdf8",
          400: "#0ea5e9",
          500: "#0284c7",
          600: "#0369a1",
          700: "#075985",
          800: "#0c4a6e",
          900: "#082f49",
        },
        hw: {
          surface: {
            0: "var(--hw-surface-0)",
            1: "var(--hw-surface-1)",
            2: "var(--hw-surface-2)",
          },
          domain: {
            brand: "var(--hw-domain-brand)",
            ec: "var(--hw-domain-ec)",
            ph: "var(--hw-domain-ph)",
            wait: "var(--hw-domain-wait)",
          },
        },
      },
    },
  },
  plugins: [],
}; 