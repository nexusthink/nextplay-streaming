/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#090d11',
          panel: '#10171e',
          card: '#151e27',
          border: '#1e2c3a',
          cyan: '#00f2fe',
          teal: '#0cebeb',
          emerald: '#10b981',
          purple: '#8b5cf6',
          danger: '#f43f5e',
        }
      },
      boxShadow: {
        'neon-cyan': '0 0 18px rgba(0, 242, 254, 0.25)',
        'neon-cyan-strong': '0 0 25px rgba(0, 242, 254, 0.45)',
      }
    },
  },
  plugins: [],
}

