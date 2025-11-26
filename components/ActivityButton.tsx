// Кнопка выбора активности
import React from 'react';
import type { ActivityType } from '@/types';

interface ActivityButtonProps {
  type: ActivityType;
  icon: string;
  label: string;
  selected?: boolean;
  onClick: () => void;
}

const ActivityButton: React.FC<ActivityButtonProps> = ({
  type,
  icon,
  label,
  selected = false,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={`btn-gold-glow px-4 sm:px-8 py-4 sm:py-6 text-sm sm:text-lg font-bold text-white group ${
        selected
          ? 'shadow-2xl shadow-amber-500/50 ring-4 ring-amber-500/50'
          : ''
      }`}
    >
      {/* Переливающийся эффект */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
      {/* Внутреннее свечение */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
      
      <div className="flex flex-col items-center gap-1 sm:gap-2 relative z-20">
        <span className="text-3xl sm:text-4xl drop-shadow-lg">{icon}</span>
        <span className="text-xs sm:text-base drop-shadow-md">{label}</span>
      </div>
      
      {selected && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg z-20">
          <span className="text-white text-xs">✓</span>
        </div>
      )}
    </button>
  );
};

export default ActivityButton;

