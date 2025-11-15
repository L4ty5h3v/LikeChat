// Progress bar for task completion
import React from 'react';

interface ProgressBarProps {
  completed: number;
  total: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ completed, total }) => {
  const percentage = (completed / total) * 100;

  return (
    <div className="w-full">
      <div className="flex justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">
          Progress
        </span>
        <span className="text-sm font-bold text-primary">
          {completed} / {total}
        </span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green-700 via-green-800 to-black transition-all duration-500 ease-out rounded-full flex items-center justify-end pr-2"
          style={{ width: `${percentage}%` }}
        >
          {percentage > 10 && (
            <span className="text-xs text-white font-semibold">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      </div>

      {/* Hearts for visualization */}
      <div className="flex justify-center gap-1 mt-3">
        {Array.from({ length: total }).map((_, index) => (
          <span
            key={index}
            className={`text-sm transition-all duration-300 ${
              index < completed
                ? 'text-primary scale-105'
                : 'text-gray-300'
            }`}
          >
            ❤️
          </span>
        ))}
      </div>
    </div>
  );
};

export default ProgressBar;

