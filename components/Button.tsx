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
    primary: 'bg-gradient-to-r from-green-700 via-green-400 to-green-700 text-white hover:shadow-xl hover:shadow-green-400/50 hover:from-green-600 hover:via-green-500 hover:to-green-600 transition-all duration-300 font-semibold',
    success: 'bg-gradient-to-r from-green-700 to-green-600 text-white hover:shadow-xl hover:shadow-green-400/50 hover:from-green-600 hover:to-green-500',
    warning: 'bg-gradient-to-r from-green-300 via-teak to-green-300 text-dark hover:shadow-xl hover:shadow-green-300/50 relative z-10',
    secondary: 'bg-light text-dark border-2 border-green-400 hover:bg-green-200 hover:text-green-700 transition-all',
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

