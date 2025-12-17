// Карточка ссылки в ленте
import React from 'react';
import type { LinkSubmission } from '@/types';
import { fallbackAvatarDataUri, normalizeAvatarUrl } from '@/lib/media';

interface LinkCardProps {
  link: LinkSubmission;
}

const activityIcon = '💎';
const activityLabel = 'Buy';

const LinkCard: React.FC<LinkCardProps> = ({ link }) => {
  const openPostLink = (url: string) => {
    if (typeof window === 'undefined') return;
    // In Base App / in-app WebViews, window.open can be blocked. Prefer same-tab navigation.
    try {
      window.location.href = url;
    } catch {
      // no-op
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const compactUrl = (url: string) => {
    try {
      const u = new URL(url);
      const path = (u.pathname || '/').replace(/\/{2,}/g, '/');
      return `${u.host}${path}`;
    } catch {
      return url;
    }
  };

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 p-5 hover:shadow-lg transition-all duration-300">
      {/* Заголовок с пользователем */}
      <div className="flex items-center gap-3 mb-3">
        <img
          src={normalizeAvatarUrl(link.pfp_url) || fallbackAvatarDataUri(link.username || link.id, 80)}
          alt={link.username || 'avatar'}
          className="w-10 h-10 rounded-full border-2 border-primary"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = fallbackAvatarDataUri(link.username || link.id, 80);
          }}
        />
        <div className="flex-1">
          <h3 className="font-bold text-gray-900">@{link.username}</h3>
          <p className="text-xs text-gray-500">{formatDate(link.created_at)}</p>
        </div>
        
        {/* Иконка активности */}
        <div className="flex items-center gap-2 px-3 py-1 bg-primary bg-opacity-10 rounded-full">
          <span className="text-xl">{activityIcon}</span>
          <span className="text-sm font-medium text-primary">
            {activityLabel}
          </span>
        </div>
      </div>

      {/* Ссылка */}
      <div className="bg-gray-50 rounded-lg p-3 mb-3">
        <a
          href={link.cast_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline truncate block text-sm"
          title={link.cast_url}
        >
          {compactUrl(link.cast_url)}
        </a>
        {link.token_address && (
          <div className="mt-2 text-xs text-gray-600 break-all">
            Token: <span className="font-mono">{link.token_address}</span>
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <div className="flex items-center gap-1">
          <span>✓</span>
          <span>Completed: {link.completed_by?.length || 0}</span>
        </div>
        
        <a
          href={link.cast_url}
          onClick={(e) => {
            e.preventDefault();
            openPostLink(link.cast_url);
          }}
          className="btn-gold-glow px-4 py-2 text-white font-bold text-sm group"
          rel="noopener noreferrer"
        >
          {/* Per-shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          {/* Inner glow */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
          <span className="relative z-20 drop-shadow-lg">Open</span>
        </a>
      </div>
    </div>
  );
};

export default LinkCard;

