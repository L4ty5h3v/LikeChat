// Кнопка выбора активности
import React, { useState, useEffect } from 'react';
import type { ActivityType } from '@/types';

interface ActivityButtonProps {
  type: ActivityType;
  icon: string;
  label: string;
  selected?: boolean;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  badgeCount?: number;
  ariaLabel?: string;
}

const ActivityButton: React.FC<ActivityButtonProps> = ({
  type,
  icon,
  label,
  selected = false,
  onClick,
  disabled = false,
  loading = false,
  badgeCount = 0,
  ariaLabel,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Handle keyboard navigation and accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || loading) return;
    
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsPressed(true);
      onClick();
    }
  };
  
  const handleKeyUp = () => {
    setIsPressed(false);
  };
  
  // Reset pressed state when disabled changes
  useEffect(() => {
    if (disabled) {
      setIsPressed(false);
    }
  }, [disabled]);
  
  // Show tooltip on hover after delay
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (isHovered && disabled) {
      timeoutId = setTimeout(() => {
        setShowTooltip(true);
      }, 500);
    } else {
      setShowTooltip(false);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isHovered, disabled]);
  
  const baseClasses = `btn-gold-glow px-4 sm:px-8 py-4 sm:py-6 text-sm sm:text-lg font-bold text-white group transition-all duration-200 ${
    disabled 
      ? 'opacity-50 cursor-not-allowed filter grayscale'
      : 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
  } ${loading ? 'animate-pulse' : ''}`;
  
  const selectedClasses = selected 
    ? 'shadow-2xl shadow-amber-500/50 ring-4 ring-amber-500/50 transform scale-105'
    : '';
    
  const pressedClasses = isPressed ? 'scale-95' : '';

  return (
    <div className="relative inline-block">
      <button
        onClick={() => {
          if (!disabled && !loading) {
            onClick();
          }
        }}
        onMouseDown={() => !disabled && !loading && setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => {
          setIsPressed(false);
          setIsHovered(false);
        }}
        onMouseEnter={() => setIsHovered(true)}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        className={`${baseClasses} ${selectedClasses} ${pressedClasses}`}
        disabled={disabled || loading}
        aria-label={ariaLabel || `${label} activity button${selected ? ', selected' : ''}${disabled ? ', disabled' : ''}${loading ? ', loading' : ''}`}
        aria-pressed={selected}
        aria-disabled={disabled || loading}
        role="radio"
        tabIndex={disabled ? -1 : 0}
        data-activity-type={type}
      >
        {/* Overlay for disabled state */}
        {disabled && (
          <div className="absolute inset-0 bg-gray-900/50 rounded-2xl z-10" />
        )}
        
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-900/20 to-transparent rounded-2xl z-10">
            <div className="w-6 h-6 border-2 border-white/50 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        
        {/* Переливающийся эффект - only when enabled and not loading */}
        {!disabled && !loading && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        )}
        
        {/* Внутреннее свечение */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
        
        {/* Ripple effect on click */}
        {!disabled && !loading && (
          <div className="absolute inset-0 overflow-hidden rounded-2xl">
            <div className={`absolute inset-0 bg-white/20 rounded-full scale-0 transition-transform duration-300 ${
              isPressed ? 'scale-100' : ''
            }`} />
          </div>
        )}
        
        <div className="flex flex-col items-center gap-1 sm:gap-2 relative z-20">
          <span className="text-3xl sm:text-4xl drop-shadow-lg">
            {loading ? '⏳' : icon}
          </span>
          <span className="text-xs sm:text-base drop-shadow-md truncate max-w-full">
            {label}
            {loading && '...'}
          </span>
        </div>
        
        {/* Selected indicator */}
        {selected && (
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg z-20 animate-bounce">
            <span className="text-white text-xs">✓</span>
          </div>
        )}
        
        {/* Badge for notifications/count */}
        {badgeCount > 0 && !selected && (
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg z-20 animate-pulse">
            <span className="text-white text-xs font-bold">
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          </div>
        )}
      </button>
      
      {/* Tooltip for disabled state */}
      {disabled && showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-30 whitespace-nowrap animate-fadeIn">
          <div className="relative">
            This activity is currently unavailable
            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
          </div>
        </div>
      )}
      
      {/* Focus indicator for accessibility */}
      <div className={`absolute inset-0 rounded-2xl ring-2 ring-blue-500 ring-offset-2 transition-all duration-200 pointer-events-none ${
        isHovered && !disabled ? 'opacity-100' : 'opacity-0'
      }`} />
    </div>
  );
};

export default ActivityButton;
