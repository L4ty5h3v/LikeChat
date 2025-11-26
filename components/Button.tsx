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
  const baseStyles = 'px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 text-sm sm:text-base relative overflow-hidden';
  
  const variantStyles = {
    primary: 'text-white hover:shadow-2xl hover:shadow-yellow-500/50 transition-all duration-300',
    success: 'text-white hover:shadow-2xl hover:shadow-green-500/50 transition-all duration-300',
    warning: 'text-white hover:shadow-2xl hover:shadow-orange-500/50 transition-all duration-300',
    secondary: 'text-white hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-300',
  };

  const widthStyles = fullWidth ? 'w-full' : '';

  const getBackgroundStyle = () => {
    if (disabled || loading) {
      return { 
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(147, 51, 234, 0.3))',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        borderRadius: '12px',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
      };
    }
    
    // Градиент: яркий красный → глубокий фиолетовый (как на кнопке "ПОДКЛЮЧИТЕ ФАРКАСТЕР")
    return { 
      background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.5), rgba(147, 51, 234, 0.5))',
      border: '1px solid rgba(255, 255, 255, 0.3)',
      borderRadius: '12px',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
      color: 'white',
    };
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={getBackgroundStyle()}
      className={`${baseStyles} ${variantStyles[variant]} ${widthStyles} ${className} group`}
    >
      {/* Переливающийся градиент поверх */}
      {!disabled && !loading && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
      )}
      {/* Внутреннее свечение */}
      {!disabled && !loading && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
      )}
      {loading ? (
        <div className="flex items-center justify-center gap-2 relative z-10">
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span>Loading...</span>
        </div>
      ) : (
        <span className="relative z-10 drop-shadow-lg">{children}</span>
      )}
    </button>
  );
};

export default Button;

