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
        primary: '#10B981',           // Emerald green
        'primary-dark': '#059669',    // Dark emerald
        'primary-light': '#34D399',   // Light emerald
        secondary: '#D4AF37',         // Classic gold
        accent: '#FFD700',            // Bright gold
        'gold': '#D4AF37',            // Classic gold
        'gold-light': '#FFD700',      // Bright gold
        'gold-dark': '#B8860B',       // Dark goldenrod
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
        dark: '#1F2937',              // Dark gray
        light: '#FEFCFB',             // Cream white
        background: '#FAF9F6',        // Light beige
        'surface': '#FFFFFF',         // White surface
        success: '#10B981',           // Emerald green
        warning: '#D4AF37',           // Classic gold
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
