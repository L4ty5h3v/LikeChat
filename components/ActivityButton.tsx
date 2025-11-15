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
      className={`
        relative px-4 sm:px-8 py-4 sm:py-6 rounded-2xl text-sm sm:text-lg font-semibold
        transition-all duration-300 transform hover:scale-105 hover:shadow-xl
        ${
          selected
            ? 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 text-white shadow-xl shadow-emerald-500/50 ring-4 ring-emerald-500/30'
            : 'bg-white text-gray-700 border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/50'
        }
      `}
    >
      <div className="flex flex-col items-center gap-1 sm:gap-2">
        <span className="text-3xl sm:text-4xl">{icon}</span>
        <span className="text-xs sm:text-base">{label}</span>
      </div>
      
      {selected && (
        <div className="absolute -top-2 -right-2 w-7 h-7 bg-gradient-to-br from-gold-400 to-gold-600 rounded-full flex items-center justify-center shadow-lg shadow-gold-500/50 ring-2 ring-white">
          <span className="text-white text-sm font-bold">✓</span>
        </div>
      )}
    </button>
  );
};

export default ActivityButton;

