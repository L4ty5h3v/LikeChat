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
            ? 'bg-gradient-to-br from-green-700 via-green-600 to-green-800 text-white shadow-xl shadow-green-600/50 ring-4 ring-green-500/30'
            : 'bg-white text-black border-2 border-black hover:bg-green-50'
        }
      `}
    >
      <div className="flex flex-col items-center gap-1 sm:gap-2">
        <span className="text-3xl sm:text-4xl">{icon}</span>
        <span className="text-xs sm:text-base">{label}</span>
      </div>
      
      {selected && (
        <div className="absolute -top-2 -right-2 w-7 h-7 bg-gold-texture rounded-full flex items-center justify-center shadow-lg ring-2 ring-black z-10">
          <span className="text-black text-sm font-bold relative z-10">✓</span>
        </div>
      )}
    </button>
  );
};

export default ActivityButton;

