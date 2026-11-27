/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F5F7FF',
          100: '#EBF0FE',
          200: '#D6E0FD',
          300: '#B0C4FC',
          400: '#7596FF',
          500: '#3B68FF',
          600: '#2554E8',
          700: '#1A42C9',
          800: '#14339E',
          900: '#0F267A',
        },
        sts: {
          safe: '#10B981',      // Xanh ngọc an toàn
          warning: '#F59E0B',   // Vàng hổ phách cảnh báo
          danger: '#F43F5E',    // Đỏ hồng vượt mức
        },
        surface: {
          DEFAULT: '#FFFFFF',
          soft: '#F8FAFC',
          muted: '#F1F5F9',
          dark: '#0B0F19',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Outfit"', '"Plus Jakarta Sans"', 'sans-serif'],
      },
      boxShadow: {
        'soft-sm': '0 2px 8px -2px rgba(15, 23, 42, 0.04), 0 1px 4px -1px rgba(15, 23, 42, 0.02)',
        'soft-md': '0 12px 32px -4px rgba(15, 23, 42, 0.06), 0 4px 12px -2px rgba(15, 23, 42, 0.03)',
        'soft-lg': '0 16px 40px -8px rgba(15, 23, 42, 0.08), 0 6px 16px -4px rgba(15, 23, 42, 0.04)',
        'soft-xl': '0 24px 48px -12px rgba(15, 23, 42, 0.08), 0 8px 24px -4px rgba(15, 23, 42, 0.04)',
        'soft-2xl': '0 28px 60px -15px rgba(15, 23, 42, 0.14), 0 12px 32px -6px rgba(15, 23, 42, 0.06)',
        'glow-emerald': '0 16px 36px -8px rgba(16, 185, 129, 0.35)',
        'glow-brand': '0 16px 36px -8px rgba(59, 104, 255, 0.35)',
        'inner-light': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.7)',
        'inner-dark': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)',
      },
      borderRadius: {
        '3xl': '1.75rem',
        '4xl': '2.25rem',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'modal-pop': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(1rem)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out both',
        'modal-pop': 'modal-pop 0.2s cubic-bezier(0.32, 0.72, 0, 1) both',
        'slide-up': 'slide-up 0.25s cubic-bezier(0.32, 0.72, 0, 1) both',
      },
    },
  },
  plugins: [],
}
