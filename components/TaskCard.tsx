// Карточка задания со ссылкой
import React from 'react';
import type { TaskProgress } from '@/types';

interface TaskCardProps {
  task: TaskProgress;
  index: number;
  onOpen: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, index, onOpen }) => {
  return (
    <div
      className={`
        p-4 rounded-xl border-2 transition-all duration-300
        ${
          task.completed && task.verified
            ? 'bg-green-50 border-success'
            : task.completed && !task.verified
            ? 'bg-yellow-50 border-warning'
            : 'bg-white border-gray-300 hover:border-primary'
        }
      `}
    >
      <div className="flex items-center gap-4">
        {/* Номер задания / Индикатор статуса (НЕ интерактивный, только визуальный) */}
        <div
          className={`
            flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg
            ${
              task.completed && task.verified
                ? 'bg-success text-white'
                : task.completed && !task.verified
                ? 'bg-warning text-white'
                : 'bg-gray-200 text-gray-600'
            }
          `}
          style={{ cursor: 'default', pointerEvents: 'none' }}
          aria-label={task.completed && task.verified ? 'Task completed' : `Task ${index + 1}`}
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
                  : 'bg-gradient-to-r from-yellow-400 via-amber-600 to-amber-800 text-white hover:shadow-xl hover:shadow-amber-500/50 hover:from-yellow-500 hover:via-amber-700 hover:to-amber-900 transition-all duration-300'
              }
            `}
          >
            {task.completed && task.verified ? 'Completed' : 'Open Post'}
          </button>
        </div>
      </div>

      {/* Статус */}
      {task.completed && !task.verified && (
        <div className="mt-3 p-2 bg-warning bg-opacity-20 rounded-lg">
          <p className="text-sm text-yellow-800 flex items-center gap-2">
            <span>⚠️</span>
            <span>Ожидается подтверждение активности</span>
          </p>
        </div>
      )}
    </div>
  );
};

export default TaskCard;

