/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Theme is chosen in Settings (system / light / dark) and applied as a class on <html>.
  darkMode: 'class',
  future: {
    // Touch screens don't get "stuck" hover styles after a tap.
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      screens: {
        '3xl': '1920px',
        /** Landscape phones and small laptop windows: compress vertical spacing. */
        short: { raw: '(max-height: 560px)' },
        touch: { raw: '(hover: none)' },
      },
      colors: {
        tone1: '#dc2626',
        tone2: '#b45309',
        tone3: '#15803d',
        tone4: '#2563eb',
        tone0: '#6b7280',
      },
      fontFamily: {
        hanzi: ['"Noto Sans SC"', '"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', '"Source Han Sans SC"', 'sans-serif'],
      },
      keyframes: {
        wave: { '0%,100%': { transform: 'scaleY(0.35)' }, '50%': { transform: 'scaleY(1)' } },
        pop: { '0%': { transform: 'scale(0.97)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-6px)' },
          '40%, 80%': { transform: 'translateX(6px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 0 0 rgba(16, 185, 129, 0.4)' },
          '70%': { boxShadow: '0 0 0 10px rgba(16, 185, 129, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(16, 185, 129, 0)' },
        },
      },
      animation: {
        wave: 'wave 0.9s ease-in-out infinite',
        pop: 'pop 0.18s ease-out',
        shake: 'shake 0.35s ease-in-out',
        glow: 'glow 0.6s ease-out',
      },
    },
  },
  plugins: [],
};
