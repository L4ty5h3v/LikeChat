// Карточка ссылки в ленте
import React from 'react';
import type { LinkSubmission } from '@/types';

interface LinkCardProps {
  link: LinkSubmission;
}

const activityIcons = {
  like: '❤️',
  recast: '🔄',
  comment: '💬',
};

const activityLabels = {
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
          <span className="text-xl">{activityIcons[link.activity_type]}</span>
          <span className="text-sm font-medium text-primary">
            {activityLabels[link.activity_type]}
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
          className="px-4 py-1 bg-primary text-white rounded-lg hover:bg-opacity-90 transition-all duration-300"
        >
          Open
        </button>
      </div>
    </div>
  );
};

export default LinkCard;

