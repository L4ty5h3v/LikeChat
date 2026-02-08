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
      const isInFarcasterFrame = typeof window !== 'undefined' && window.self !== window.top;
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      
      // Определяем версию iOS для совместимости со старыми версиями
      const iosVersion = isIOS ? (() => {
        const match = navigator.userAgent.match(/OS (\d+)_(\d+)/);
        return match ? parseFloat(`${match[1]}.${match[2]}`) : null;
      })() : null;
      
      if (isInFarcasterFrame) {
        // КРИТИЧНО: Сначала пробуем SDK методы - они должны работать правильно
        const { sdk } = await import('@farcaster/miniapp-sdk');
        try {
          if (sdk?.actions?.ready) await sdk.actions.ready();
        } catch {}
        
        // Метод 1: viewCast с hash (для кастов Farcaster - открывает в приложении, лучше для iOS)
        // Приоритет для кастов Farcaster, особенно на iOS 16 и ниже
        if (sdk?.actions?.viewCast) {
          try {
            const { extractCastHash, getFullCastHash } = await import('@/lib/neynar');
            // Сначала пробуем извлечь hash напрямую
            let hash = extractCastHash(url);
            // Если не нашли, пробуем разрешить через API
            if (!hash) {
              hash = await getFullCastHash(url);
            }
            if (hash) {
              console.log(`🔍 [LINKCARD] Using viewCast for cast hash: ${hash}`);
              await (sdk.actions.viewCast as any)({ hash });
              return;
            }
          } catch (e: any) {
            console.warn('⚠️ [LINKCARD] viewCast failed:', e?.message);
          }
        }
        
        // Метод 2: openUrl через SDK с target для выхода из iframe на iOS
        if (sdk?.actions?.openUrl) {
          try {
            // Для iOS используем target: 'system' чтобы открыть в системном браузере/приложении
            // Это выводит ссылку за пределы iframe, где Farcaster app может её подхватить
            const target = isIOS ? 'system' : undefined;
            console.log(`🔍 [LINKCARD] Using openUrl with target: ${target || 'default'}`);
            await sdk.actions.openUrl({ url, ...(target && { target }) });
            return;
          } catch (e: any) {
            console.warn('⚠️ [LINKCARD] openUrl failed, trying fallback:', e?.message);
            // Если target: 'system' не сработал, пробуем 'top'
            if (isIOS) {
              try {
                await sdk.actions.openUrl({ url, target: 'top' });
                return;
              } catch (e2: any) {
                console.warn('⚠️ [LINKCARD] openUrl with target:top failed:', e2?.message);
              }
            }
          }
        }
        
        // Метод 3: Для iOS - прямой выход из iframe (только если SDK не сработал)
        if (isIOS && window.top && window.top !== window.self) {
          try {
            window.top.location.href = url;
            return;
          } catch {
            try {
              window.top.location.replace(url);
              return;
            } catch {
              try {
                window.open(url, '_top');
                return;
              } catch {
                const link = document.createElement('a');
                link.href = url;
                link.target = '_top';
                link.style.cssText = 'position:fixed;top:-9999px;';
                document.body.appendChild(link);
                link.click();
                setTimeout(() => {
                  try {
                    document.body.removeChild(link);
                  } catch {}
                }, 100);
                return;
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ [LINKCARD] Failed to open via SDK/postMessage, falling back:', error);
    }
    
    // Fallback: если SDK недоступен, используем обычное открытие
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isIOS) {
      const farcasterDeeplink = `farcaster://cast?url=${encodeURIComponent(url)}`;
      window.location.href = farcasterDeeplink;
      setTimeout(() => {
        window.open(url, '_blank');
      }, 1000);
    } else {
      window.open(url, '_blank');
    }
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

