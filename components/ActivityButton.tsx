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
            ? 'bg-primary text-white shadow-lg ring-4 ring-primary ring-opacity-50'
            : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-primary'
        }
      `}
    >
      <div className="flex flex-col items-center gap-1 sm:gap-2">
        <span className="text-3xl sm:text-4xl">{icon}</span>
        <span className="text-xs sm:text-base">{label}</span>
      </div>
      
      {selected && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-success rounded-full flex items-center justify-center">
          <span className="text-white text-xs">✓</span>
        </div>
      )}
    </button>
  );
};

export default ActivityButton;

