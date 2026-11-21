/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        royal: {
          white: '#F7F7F4',
          pearl: '#EEEDE8',
          lightGrey: '#D6D6D2',
          mediumGrey: '#A7A8A5',
          darkGrey: '#666762',
          silver: '#BFC1C2',
          gold: '#C6A45C',
          goldLight: '#E2CCA0',
          charcoal: '#202226',
          panel: 'rgba(247, 247, 244, 0.92)',
          panelDark: 'rgba(238, 237, 232, 0.95)',
          border: 'rgba(198, 164, 92, 0.32)',
          borderMuted: 'rgba(102, 103, 98, 0.18)',
        },
        room: {
          panel: 'rgba(247, 247, 244, 0.92)',
          border: 'rgba(198, 164, 92, 0.35)',
        }
      },
      fontFamily: {
        serif: ['Playfair Display', 'Cinzel', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow-gold': '0 0 20px rgba(198, 164, 92, 0.35)',
        'glow-silver': '0 0 20px rgba(191, 193, 194, 0.35)',
        'royal-card': '0 12px 32px -4px rgba(32, 34, 38, 0.14), 0 0 0 1px rgba(198, 164, 92, 0.25)',
        'room-card': '0 12px 32px -4px rgba(32, 34, 38, 0.14), 0 0 0 1px rgba(198, 164, 92, 0.25)',
      }
    },
  },
  plugins: [],
}
