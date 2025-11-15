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
    <div className="bg-light rounded-xl border-2 border-green-400 p-5 hover:shadow-xl transition-all duration-300 hover:border-green-700">
      {/* Заголовок с пользователем */}
      <div className="flex items-center gap-3 mb-3">
        {link.pfp_url && (
          <img
            src={link.pfp_url}
            alt={link.username}
            className="w-10 h-10 rounded-full border-2 border-green-400 ring-2 ring-green-100"
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
        <div className="flex items-center gap-2 px-3 py-1 bg-white border-2 border-green-400 rounded-full shadow-sm">
          <span className="text-xl">{activityIcons[link.activity_type]}</span>
          <span className="text-sm font-semibold text-green-700">
            {activityLabels[link.activity_type]}
          </span>
        </div>
      </div>

      {/* Ссылка */}
      <div className="bg-white border-2 border-green-400 rounded-lg p-3 mb-3">
        <a
          href={link.cast_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-green-700 hover:text-green-800 hover:underline break-all text-sm font-medium"
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
          className="px-4 py-1.5 bg-gradient-to-r from-green-700 to-green-800 text-white rounded-lg hover:from-green-600 hover:to-green-700 hover:shadow-lg hover:shadow-green-600/50 transition-all duration-300 font-medium text-sm"
        >
          Open
        </button>
      </div>
    </div>
  );
};

export default LinkCard;

