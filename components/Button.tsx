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
    primary: 'bg-gradient-to-r from-yellow-300 via-yellow-500 via-amber-600 to-amber-800 text-white hover:shadow-xl hover:shadow-amber-500/50 hover:from-yellow-400 hover:via-yellow-600 hover:via-amber-700 hover:to-amber-900 transition-all duration-300 relative overflow-hidden',
    success: 'bg-gradient-to-r from-yellow-400 via-amber-500 to-amber-700 text-white hover:shadow-xl hover:shadow-amber-500/50 hover:from-yellow-500 hover:via-amber-600 hover:to-amber-800 transition-all duration-300',
    warning: 'bg-gradient-to-r from-yellow-300 via-amber-500 to-amber-800 text-white hover:shadow-xl hover:shadow-amber-500/50 hover:from-yellow-400 hover:via-amber-600 hover:to-amber-900 transition-all duration-300',
    secondary: 'bg-gradient-to-r from-yellow-100 to-amber-100 text-amber-900 border-2 border-amber-300 hover:from-yellow-200 hover:to-amber-200 hover:border-amber-400',
  };

  const widthStyles = fullWidth ? 'w-full' : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
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

