/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cyber: {
          void: '#0a0a0f',
          panel: '#0d1117',
          card: '#161b22',
          border: '#1c2333',
          green: '#00ff41',
          pink: '#ff2a6d',
          cyan: '#05d9e8',
          yellow: '#f5d400',
          purple: '#d400ff',
          text: '#e0e0e0',
          muted: '#6b7280',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        display: ['Orbitron', 'sans-serif'],
      },
      boxShadow: {
        neon: '0 0 8px rgba(0,255,65,0.5), 0 0 20px rgba(0,255,65,0.2)',
        neonPink: '0 0 8px rgba(255,42,109,0.5), 0 0 20px rgba(255,42,109,0.2)',
        neonCyan: '0 0 8px rgba(5,217,232,0.5), 0 0 20px rgba(5,217,232,0.2)',
      },
      animation: {
        blink: 'blink 1s step-end infinite',
        glitch: 'glitch 2s infinite',
        scanline: 'scanline 8s linear infinite',
        pulse: 'pulse 2s ease-in-out infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        glitch: {
          '0%, 90%, 100%': { transform: 'translate(0)' },
          '92%': { transform: 'translate(-2px, 1px)' },
          '94%': { transform: 'translate(2px, -1px)' },
          '96%': { transform: 'translate(-1px, 2px)' },
          '98%': { transform: 'translate(1px, -2px)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
    },
  },
  plugins: [],
}
