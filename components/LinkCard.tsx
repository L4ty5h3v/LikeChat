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
};

const activityLabels: Record<TaskType, string> = {
  like: 'Like',
  recast: 'Recast',
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

  const handleOpenLink = async (url: string) => {
    // Используем SDK для открытия ссылки в Farcaster (работает на всех платформах, включая iOS)
    try {
      // Проверяем, что мы в Farcaster Mini App
      if (typeof window !== 'undefined' && window.self !== window.top) {
        const { sdk } = await import('@farcaster/miniapp-sdk');
        
        if (sdk?.actions?.openUrl) {
          // Используем SDK для открытия ссылки в Farcaster
          await sdk.actions.openUrl({ url });
          console.log(`✅ [LINKCARD] Link opened via SDK: ${url}`);
          return;
        }
      }
    } catch (error) {
      console.warn('⚠️ [LINKCARD] Failed to open via SDK, falling back to window.open:', error);
    }
    
    // Fallback: если SDK недоступен, используем обычное открытие
    window.open(url, '_blank');
  };

  const handleLinkClick = async (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    e.preventDefault();
    await handleOpenLink(url);
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
          className="text-primary hover:underline break-all text-sm cursor-pointer"
          onClick={(e) => handleLinkClick(e, link.cast_url)}
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
          onClick={() => handleOpenLink(link.cast_url)}
          className="btn-gold-glow px-4 py-2 text-white font-bold text-sm group"
        >
          {/* Переливающийся эффект */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          {/* Внутреннее свечение */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
          <span className="relative z-20 drop-shadow-lg">Open</span>
        </button>
      </div>
    </div>
  );
};

export default LinkCard;

