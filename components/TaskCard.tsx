// Карточка задания со ссылкой
import React from 'react';
import type { TaskProgress } from '@/types';

interface TaskCardProps {
  task: TaskProgress;
  index: number;
  onOpen: () => void;
  onToggleComplete?: (nextState: boolean) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, index, onOpen, onToggleComplete }) => {
  return (
    <div
        className={`
        p-4 rounded-xl border-2 transition-all duration-300 shadow-sm
        ${
          task.completed && task.verified
            ? 'bg-green-50/80 border-green-600 shadow-green-200/50'
            : task.completed && !task.verified
            ? 'bg-gold-50/80 border-gold-400 shadow-gold-200/50'
            : 'bg-white border-black hover:border-green-700 hover:shadow-green-100/50'
        }
      `}
    >
      <div className="flex items-center gap-4">
        {/* Номер задания */}
        <div
          className={`
            flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-md
            ${
              task.completed && task.verified
                ? 'bg-gradient-to-br from-green-700 to-green-900 text-white shadow-green-600/50'
                : task.completed && !task.verified
                ? 'bg-gold-texture text-black shadow-gold-500/50'
                : 'bg-white text-black border-2 border-black'
            }
          `}
        >
          {task.completed && task.verified ? '✓' : index + 1}
        </div>

        {/* Информация о пользователе */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {task.pfp_url && (
              <img
                src={task.pfp_url}
                alt={task.username}
                className="w-6 h-6 rounded-full"
                onError={(e) => {
                  // Fallback на дефолтный аватар при ошибке загрузки
                  const target = e.target as HTMLImageElement;
                  target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${task.username}`;
                }}
              />
            )}
            <span className="font-semibold text-gray-900">@{task.username}</span>
          </div>
          <p className="text-sm text-gray-600 truncate">{task.cast_url}</p>
        </div>

        {/* Кнопки действий */}
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={onOpen}
            disabled={task.completed && task.verified}
            className={`
              px-4 py-1.5 rounded-lg font-medium text-sm transition-all duration-300
              ${
                task.completed && task.verified
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-700 to-green-800 text-white hover:from-green-600 hover:to-green-700 hover:shadow-lg hover:shadow-green-600/50'
              }
            `}
          >
            {task.completed && task.verified ? 'Completed' : 'Open'}
          </button>

          {onToggleComplete && (
            <label className="flex items-center gap-2 text-xs text-gray-500 select-none">
              <input
                type="checkbox"
                className="w-4 h-4 accent-primary"
                checked={task.completed}
                onChange={(event) => onToggleComplete(event.target.checked)}
              />
              <span>{task.completed ? 'Marked done' : 'Mark done'}</span>
            </label>
          )}
        </div>
      </div>

      {/* Статус */}
      {task.completed && !task.verified && (
        <div className="mt-3 p-2 bg-gradient-to-r from-gold-100 to-gold-50 border border-gold-300 rounded-lg">
          <p className="text-sm text-gold-900 flex items-center gap-2 font-medium">
            <span>⚠️</span>
            <span>Ожидается подтверждение активности</span>
          </p>
        </div>
      )}
    </div>
  );
};

export default TaskCard;

