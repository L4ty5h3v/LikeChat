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
        // Новая палитра из TCX кодов
        'coconut': '#F8F7F4',          // 11-0608 TCX - Кокосовое молоко (Coconut Milk)
        'smoky-green': '#9CAF88',      // 15-6315 TCX - Дымный зеленый (Smoky Green)
        'fog': '#D5D5D5',              // 13-0007 TCX - Туман (Fog)
        'olive': '#6B7C3F',            // 17-0115 TCX - Оливковый зеленый (Olive Green)
        'teak': '#9C8B7A',             // 17-1112 TCX - Обветренный тик (Weathered Teak)
        'mountain': '#2D4A2F',         // 19-5918 TCX - Горный зеленый (Mountain Green)
        
        primary: '#6B7C3F',            // Оливковый зеленый (Olive Green)
        'primary-dark': '#2D4A2F',     // Горный зеленый (Mountain Green)
        'primary-light': '#9CAF88',    // Дымный зеленый (Smoky Green)
        secondary: '#9C8B7A',          // Обветренный тик (Weathered Teak)
        accent: '#9CAF88',             // Дымный зеленый (Smoky Green)
        'gold': '#9C8B7A',             // Обветренный тик (Weathered Teak) - как акцент
        'gold-light': '#D5D5D5',       // Туман (Fog) - светлый акцент
        'gold-dark': '#6B7C3F',        // Оливковый зеленый (Olive Green)
        'green': {
          50: '#F8F7F4',      // Кокосовое молоко (Coconut Milk)
          100: '#D5D5D5',     // Туман (Fog)
          200: '#9CAF88',     // Дымный зеленый (Smoky Green)
          300: '#9C8B7A',     // Обветренный тик (Weathered Teak)
          400: '#6B7C3F',     // Оливковый зеленый (Olive Green)
          500: '#6B7C3F',      // Оливковый зеленый (Olive Green)
          600: '#4A5A2F',     // Средний темный зеленый
          700: '#2D4A2F',     // Горный зеленый (Mountain Green)
          800: '#1F3A1F',     // Очень темный зеленый
          900: '#0F2A0F',     // Почти черный зеленый
        },
        'emerald': {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
        },
        'gold': {
          50: '#FFFBEB',
          100: '#FFF8E1',
          200: '#FFECB3',
          300: '#FFE082',
          400: '#FFD54F',
          500: '#FFD700',      // Bright gold
          600: '#D4AF37',      // Classic gold
          700: '#B8860B',      // Dark goldenrod
          800: '#9A7208',
          900: '#7A5A06',
        },
        'amber': {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },
        dark: '#2D4A2F',              // Горный зеленый (Mountain Green)
        light: '#F8F7F4',             // Кокосовое молоко (Coconut Milk)
        background: '#F8F7F4',        // Кокосовое молоко (Coconut Milk) - фон
        'surface': '#FFFFFF',         // Белая поверхность
        black: '#2D4A2F',             // Горный зеленый (Mountain Green) - как черный
        white: '#F8F7F4',             // Кокосовое молоко (Coconut Milk) - как белый
        success: '#6B7C3F',           // Оливковый зеленый (Olive Green)
        warning: '#9C8B7A',           // Обветренный тик (Weathered Teak)
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
        }
      },
      backgroundSize: {
        '300%': '300% 300%'
      }
    },
  },
  plugins: [],
}
