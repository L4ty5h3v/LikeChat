// Progress bar for task completion
import React from 'react';
import type { TaskProgress } from '@/types';

interface ProgressBarProps {
  completed: number;
  total: number;
  tasks?: TaskProgress[]; // Опционально: для отображения статусов
}

const ProgressBar: React.FC<ProgressBarProps> = ({ completed, total, tasks }) => {
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
          className="h-full bg-gradient-to-r from-primary via-red-600 to-accent transition-all duration-500 ease-out rounded-full flex items-center justify-end pr-2"
          style={{ width: `${percentage}%` }}
        >
          {percentage > 10 && (
            <span className="text-xs text-white font-semibold">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      </div>

      {/* Статусы задач для визуализации */}
      {tasks && tasks.length > 0 && (
        <div className="flex justify-center gap-1 mt-3 flex-wrap">
          {tasks.map((task, index) => {
            let emoji = '⏳'; // Ожидает проверки
            let className = 'text-gray-400';
            
            if (task.completed && task.verified) {
              emoji = '🟢'; // Выполнено
              className = 'text-green-500 scale-110';
            } else if (task.error) {
              emoji = '🔴'; // Ошибка
              className = 'text-red-500 scale-110';
            } else if (task.verifying) {
              emoji = '🟡'; // Выполняется
              className = 'text-yellow-500 scale-110 animate-pulse';
            }
            
            return (
              <span
                key={task.link_id}
                className={`text-sm transition-all duration-300 ${className}`}
                title={
                  task.completed && task.verified
                    ? 'Выполнено'
                    : task.error
                    ? 'Ошибка'
                    : task.verifying
                    ? 'Выполняется'
                    : 'Ожидает проверки'
                }
              >
                {emoji}
              </span>
            );
          })}
        </div>
      )}

      {/* Hearts for visualization (fallback если нет tasks) */}
      {(!tasks || tasks.length === 0) && (
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
      )}
    </div>
  );
};

export default ProgressBar;

