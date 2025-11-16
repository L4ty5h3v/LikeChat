/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#B71C1C',     // Гранатовый красный
        'primary-dark': '#8B0000', // Темный гранатовый
        'primary-light': '#D32F2F', // Светлый гранатовый
        secondary: '#FF6B35',   // Оранжевый
        accent: '#8B5CF6',      // Фиолетовый
        dark: '#1A1A1A',        // Тёмный
        light: '#F8F9FA',       // Светлый
        success: '#00D084',     // Ярко-зелёный
        warning: '#FFB800',     // Жёлтый
        gold: '#D4AF37',        // Золотой
        'gold-light': '#FFD700', // Светло-золотой
        'gold-dark': '#B8860B',  // Тёмно-золотой
      },
      fontFamily: {
        'bold': ['Inter', 'system-ui', 'sans-serif'],
        'display': ['Space Grotesk', 'system-ui', 'sans-serif'],
        'script': ['Dancing Script', 'cursive'],
        'elegant': ['Great Vibes', 'cursive'],
        'handwritten': ['Allura', 'cursive'],
        'italic': ['Sacramento', 'cursive'],
        'playful': ['Kalam', 'cursive'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gradient': 'gradient 8s ease infinite',
        'float': 'float 6s ease-in-out infinite',
        'slide-down': 'slideDown 0.5s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
      },
      keyframes: {
        gradient: {
          '0%, 100%': {
            'background-position': '0% 50%'
          },
          '50%': {
            'background-position': '100% 50%'
          }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        slideDown: {
          '0%': { transform: 'translateX(-50%) translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(-50%) translateY(0)', opacity: '1' }
        },
        scaleIn: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        }
      },
      backgroundSize: {
        '300%': '300% 300%'
      }
    },
  },
  plugins: [],
}
