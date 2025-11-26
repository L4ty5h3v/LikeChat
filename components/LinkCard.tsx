// Карточка ссылки в ленте
import React from 'react';
import type { LinkSubmission } from '@/types';

interface LinkCardProps {
  link: LinkSubmission;
}

import type { TaskType } from '@/types';

const activityIcons: Record<TaskType, string> = {
  like: '❤️',
  recast: '🔄',
  comment: '💬',
};

const activityLabels: Record<TaskType, string> = {
  like: 'Like',
  recast: 'Recast',
  comment: 'Comment',
};

const LinkCard: React.FC<LinkCardProps> = ({ link }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 p-5 hover:shadow-lg transition-all duration-300">
      {/* Заголовок с пользователем */}
      <div className="flex items-center gap-3 mb-3">
        {link.pfp_url && (
          <img
            src={link.pfp_url}
            alt={link.username}
            className="w-10 h-10 rounded-full border-2 border-primary"
            onError={(e) => {
              // Fallback на дефолтный аватар при ошибке загрузки
              const target = e.target as HTMLImageElement;
              target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${link.username}`;
            }}
          />
        )}
        <div className="flex-1">
          <h3 className="font-bold text-gray-900">@{link.username}</h3>
          <p className="text-xs text-gray-500">{formatDate(link.created_at)}</p>
        </div>
        
        {/* Иконка активности */}
        <div className="flex items-center gap-2 px-3 py-1 bg-primary bg-opacity-10 rounded-full">
          <span className="text-xl">{activityIcons[link.task_type]}</span>
          <span className="text-sm font-medium text-primary">
            {activityLabels[link.task_type]}
          </span>
        </div>
      </div>

      {/* Ссылка */}
      <div className="bg-gray-50 rounded-lg p-3 mb-3">
        <a
          href={link.cast_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline break-all text-sm"
        >
          {link.cast_url}
        </a>
      </div>

      {/* Statistics */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <div className="flex items-center gap-1">
          <span>✓</span>
          <span>Completed: {link.completed_by?.length || 0}</span>
        </div>
        
        <button
          onClick={() => window.open(link.cast_url, '_blank')}
          className="relative group px-4 py-2 rounded-2xl text-white font-bold text-sm
            transition-all duration-300 transform hover:scale-105 overflow-hidden
            backdrop-blur-md border border-white/30 shadow-2xl
            hover:shadow-2xl hover:shadow-amber-500/50"
          style={{ 
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.5), rgba(147, 51, 234, 0.5))',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '12px',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
          }}
        >
          {/* Переливающийся эффект */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          {/* Внутреннее свечение */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
          <span className="relative z-10 drop-shadow-lg">Open</span>
        </button>
      </div>
    </div>
  );
};

export default LinkCard;

