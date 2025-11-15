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
    primary: 'bg-gradient-to-r from-green-700 via-green-600 to-green-800 text-white hover:shadow-xl hover:shadow-green-600/50 hover:from-green-600 hover:via-green-700 hover:to-green-900 transition-all duration-300 font-semibold',
    success: 'bg-gradient-to-r from-green-700 to-green-800 text-white hover:shadow-xl hover:shadow-green-600/50 hover:from-green-600 hover:to-green-700',
    warning: 'bg-gold-texture text-black hover:shadow-xl hover:shadow-gold-500/50 relative z-10',
    secondary: 'bg-white text-black border-2 border-black hover:bg-black hover:text-white transition-all',
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

