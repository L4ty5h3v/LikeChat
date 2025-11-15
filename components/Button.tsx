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
    primary: 'bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 text-white hover:shadow-xl hover:shadow-emerald-500/50 hover:from-emerald-400 hover:via-emerald-500 hover:to-emerald-600 transition-all duration-300 font-semibold',
    success: 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:shadow-xl hover:shadow-emerald-500/50 hover:from-emerald-400 hover:to-emerald-500',
    warning: 'bg-gradient-to-r from-gold-500 via-gold-600 to-gold-700 text-white hover:shadow-xl hover:shadow-gold-500/50 hover:from-gold-400 hover:via-gold-500 hover:to-gold-600',
    secondary: 'bg-gradient-to-r from-gold-100 to-gold-50 text-gold-900 border-2 border-gold-300 hover:border-gold-400 hover:from-gold-200 hover:to-gold-100',
  };

  const widthStyles = fullWidth ? 'w-full' : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyles} ${variantStyles[variant]} ${widthStyles} ${className}`}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2">
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span>Loading...</span>
        </div>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;

