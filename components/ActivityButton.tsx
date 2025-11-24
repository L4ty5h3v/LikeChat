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
        relative w-full px-6 sm:px-8 py-4 sm:py-5 rounded-2xl text-white font-bold text-base sm:text-lg
        transition-all duration-300 transform hover:scale-[1.02] hover:shadow-xl
        bg-gradient-to-r from-red-500 to-purple-600
        ${
          selected
            ? 'shadow-2xl shadow-red-500/50 ring-2 ring-green-500'
            : 'hover:shadow-lg'
        }
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="text-2xl sm:text-3xl">{icon}</span>
          <span>{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {selected && (
            <span className="text-green-500 text-xl">✓</span>
          )}
          <span className="text-xl sm:text-2xl">💫</span>
        </div>
      </div>
    </button>
  );
};

export default ActivityButton;

