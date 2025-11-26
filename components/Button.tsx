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
  const baseStyles = 'px-4 sm:px-6 py-2.5 sm:py-3 font-bold text-sm sm:text-base btn-gold-glow';
  
  const variantStyles = {
    primary: 'text-white hover:shadow-2xl hover:shadow-yellow-500/50 transition-all duration-300',
    success: 'text-white hover:shadow-2xl hover:shadow-green-500/50 transition-all duration-300',
    warning: 'text-white hover:shadow-2xl hover:shadow-orange-500/50 transition-all duration-300',
    secondary: 'text-white hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-300',
  };

  const widthStyles = fullWidth ? 'w-full' : '';

  const getBackgroundStyle = () => {
    // Используем CSS класс для золотого свечения
    return {};
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={getBackgroundStyle()}
      className={`${baseStyles} ${variantStyles[variant]} ${widthStyles} ${className} ${disabled || loading ? 'disabled' : ''}`}
    >
      {/* Переливающийся градиент поверх */}
      {!disabled && !loading && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 z-10"></div>
      )}
      {loading ? (
        <div className="flex items-center justify-center gap-2 relative z-20">
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span>Loading...</span>
        </div>
      ) : (
        <span className="relative z-20 drop-shadow-lg">{children}</span>
      )}
    </button>
  );
};

export default Button;

