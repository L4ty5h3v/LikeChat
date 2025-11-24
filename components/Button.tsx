// Универсальный компонент кнопки
import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'success' | 'warning' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = false,
  type = 'button',
  className = '',
}) => {
  const baseStyles = 'px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 text-sm sm:text-base';
  
  const variantStyles = {
    primary: 'text-white hover:shadow-xl hover:shadow-yellow-500/50 transition-all duration-300 relative overflow-hidden',
    success: 'text-white hover:shadow-xl hover:shadow-yellow-500/50 transition-all duration-300',
    warning: 'text-white hover:shadow-xl hover:shadow-yellow-500/50 transition-all duration-300',
    secondary: 'text-amber-900 border-2 border-yellow-400 hover:border-yellow-500',
  };

  const widthStyles = fullWidth ? 'w-full' : '';

  const getBackgroundStyle = () => {
    if (disabled || loading) {
      return { background: 'linear-gradient(to right, #C0A030, #9A7308)' }; // Приглушенный золотой для disabled
    }
    
    switch (variant) {
      case 'primary':
        return { background: 'linear-gradient(to right, #FFD700, #B8860B)' };
      case 'success':
        return { background: 'linear-gradient(to right, #FFD700, #B8860B)' };
      case 'warning':
        return { background: 'linear-gradient(to right, #FFD700, #B8860B)' };
      case 'secondary':
        return { background: 'linear-gradient(to right, #FFF9DC, #FFE5B4)' };
      default:
        return { background: 'linear-gradient(to right, #FFD700, #B8860B)' };
    }
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={getBackgroundStyle()}
      className={`${baseStyles} ${variantStyles[variant]} ${widthStyles} ${className} relative`}
    >
      {/* Металлический эффект через псевдоэлемент */}
      {variant === 'primary' && !disabled && !loading && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full hover:translate-x-full transition-transform duration-1000"></div>
      )}
      {loading ? (
        <div className="flex items-center justify-center gap-2 relative z-10">
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span>Loading...</span>
        </div>
      ) : (
        <span className="relative z-10">{children}</span>
      )}
    </button>
  );
};

export default Button;

