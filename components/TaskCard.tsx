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
        {/* Номер задания */}
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
              />
            )}
            <span className="font-semibold text-gray-900">@{task.username}</span>
          </div>
          <p className="text-sm text-gray-600 truncate">{task.cast_url}</p>
        </div>

        {/* Кнопка открытия */}
        <button
          onClick={onOpen}
          disabled={task.completed && task.verified}
          className={`
            px-4 py-1.5 rounded-lg font-medium text-sm transition-all duration-300
            ${
              task.completed && task.verified
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-primary text-white hover:bg-opacity-90 hover:shadow-lg'
            }
          `}
        >
          {task.completed && task.verified ? 'Completed' : 'Open'}
        </button>
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

