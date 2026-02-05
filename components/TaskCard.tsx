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
            task.error
              ? 'bg-red-50 border-red-500 shadow-lg shadow-red-200'
              : (task.completed && task.verified) || (task.opened && !task.error)
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
              task.error
                ? 'bg-red-500 text-white'
                : (task.completed && task.verified) || (task.opened && !task.error)
                ? 'bg-success text-white'
                : task.completed && !task.verified
                ? 'bg-warning text-white'
                : 'bg-gray-200 text-gray-600'
            }
          `}
          style={{ cursor: 'default', pointerEvents: 'none' }}
          aria-label={(task.completed && task.verified) || (task.opened && !task.error) ? 'Task completed' : task.error ? 'Task error' : `Task ${index + 1}`}
        >
          {task.error ? '❌' : ((task.completed && task.verified) || (task.opened && !task.error)) ? '✓' : index + 1}
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
          {task.cast_url ? (
            <a
              href={task.cast_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-purple-600 hover:text-purple-700 hover:underline break-all block truncate"
              onClick={(e) => {
                // Не предотвращаем открытие ссылки, но также вызываем onOpen для отслеживания
                if (!task.opened) {
                  // onOpen будет вызван отдельно через кнопку "Open"
                }
              }}
            >
              {task.cast_url}
            </a>
          ) : (
            <p className="text-sm text-gray-600 truncate">No link available</p>
          )}
        </div>

        {/* Кнопки действий */}
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={onOpen}
            disabled={(task.completed && task.verified) || (task.opened && !task.error)}
            className={`
              px-4 py-1.5 rounded-lg font-medium text-sm transition-all duration-300
              ${
                (task.completed && task.verified) || (task.opened && !task.error)
                  ? 'bg-green-500 text-white cursor-not-allowed hover:bg-green-600'
                  : task.error
                  ? 'bg-red-500 text-white hover:bg-red-600 hover:shadow-lg'
                  : task.verifying
                  ? 'bg-yellow-500 text-white cursor-wait hover:bg-yellow-600'
                  : task.opened
                  ? 'bg-blue-500 text-white hover:bg-blue-600 hover:shadow-lg'
                  : 'bg-gray-500 text-white hover:bg-gray-600 hover:shadow-lg'
              }
            `}
          >
            {(task.completed && task.verified) || (task.opened && !task.error)
              ? 'Completed ✓' 
              : task.error
              ? 'Error: Action not found'
              : task.verifying
              ? 'In Progress...'
              : task.opened 
              ? 'Opened' 
              : 'Open'}
          </button>
        </div>
      </div>

      {/* Статус */}
      {task.error && !task.completed && (
        <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded-lg">
          <p className="text-sm text-red-800 flex items-center gap-2 font-semibold">
            <span>❌</span>
            <span>Error: Action not found.</span>
          </p>
        </div>
      )}
      {task.completed && !task.verified && !task.error && (
        <div className="mt-3 p-2 bg-warning bg-opacity-20 rounded-lg">
          <p className="text-sm text-yellow-800 flex items-center gap-2">
            <span>⚠️</span>
            <span>Waiting for task confirmation</span>
          </p>
        </div>
      )}
    </div>
  );
};

export default TaskCard;

