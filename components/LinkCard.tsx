// Карточка ссылки в ленте
import React from 'react';
import type { LinkSubmission } from '@/types';
import Avatar from '@/components/Avatar';

interface LinkCardProps {
  link: LinkSubmission;
}

const activityIcon = '💎';
const activityLabel = 'Buy';

const LinkCard: React.FC<LinkCardProps> = ({ link }) => {
  const openPostLink = (url: string): boolean => {
    if (typeof window === 'undefined') return false;
    // Keep the app state: do NOT navigate the current WebView.
    try {
      const w = window.open(url, '_blank', 'noopener,noreferrer');
      if (w) return true;
    } catch {}
    try {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    } catch {}
    return false;
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

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 p-5 hover:shadow-lg transition-all duration-300">
      {/* Заголовок с пользователем */}
      <div className="flex items-center gap-3 mb-3">
        <Avatar
          url={link.pfp_url}
          seed={link.username || link.id}
          size={40}
          alt={link.username || 'avatar'}
          className="rounded-full object-cover border-2 border-primary"
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

      {/* Token */}
      {link.token_address && (
        <div className="bg-gray-50 rounded-lg p-3 mb-3">
          <div className="text-xs text-gray-600 break-all">
            Token: <span className="font-mono">{link.token_address}</span>
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <div className="flex items-center gap-1">
          <span>✓</span>
          <span>Completed: {link.completed_by?.length || 0}</span>
        </div>
        
        {!!link.cast_url && link.cast_url.trim().startsWith('http') ? (
          <a
            href={link.cast_url}
            onClick={(e) => {
              e.preventDefault();
              const url = link.cast_url.trim();
              const ok = openPostLink(url);
              if (!ok) {
                try {
                  window.prompt('Copy link:', url);
                } catch {
                  // ignore
                }
              }
            }}
            className="btn-gold-glow px-4 py-2 text-white font-bold text-sm group"
            rel="noopener noreferrer"
            target="_blank"
          >
            {/* Per-shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            {/* Inner glow */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
            <span className="relative z-20 drop-shadow-lg">Read the post</span>
          </a>
        ) : (
          <span className="text-xs text-gray-500 font-bold">No post link</span>
        )}
      </div>
    </div>
  );
};

export default LinkCard;

