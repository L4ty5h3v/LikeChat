// Карточка задания со ссылкой
import React from 'react';
import type { TaskProgress } from '@/types';

interface TaskCardProps {
  task: TaskProgress;
  index: number;
  onOpen: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, index, onOpen }) => {
  const handleLinkClick = async (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    e.preventDefault();
    
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
              console.log(`🔍 [TASKCARD] Using viewCast for cast hash: ${hash}`);
              await (sdk.actions.viewCast as any)({ hash });
              return;
            }
          } catch (e: any) {
            console.warn('⚠️ [TASKCARD] viewCast failed:', e?.message);
          }
        }
        
        // Метод 2: openUrl через SDK с target для выхода из iframe на iOS
        if (sdk?.actions?.openUrl) {
          try {
            // Для iOS используем target: 'system' чтобы открыть в системном браузере/приложении
            // Это выводит ссылку за пределы iframe, где Farcaster app может её подхватить
            const target = isIOS ? 'system' : undefined;
            console.log(`🔍 [TASKCARD] Using openUrl with target: ${target || 'default'}`);
            await sdk.actions.openUrl({ url, ...(target && { target }) });
            return;
          } catch (e: any) {
            console.warn('⚠️ [TASKCARD] openUrl failed, trying fallback:', e?.message);
            // Если target: 'system' не сработал, пробуем 'top'
            if (isIOS) {
              try {
                await sdk.actions.openUrl({ url, target: 'top' });
                return;
              } catch (e2: any) {
                console.warn('⚠️ [TASKCARD] openUrl with target:top failed:', e2?.message);
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
      console.warn('⚠️ [TASKCARD] Failed to open via SDK/postMessage, falling back:', error);
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
  return (
    <div
        className={`
          p-4 rounded-xl border-2 transition-all duration-300
          ${
            task.error
              ? 'bg-red-50 border-red-500 shadow-lg shadow-red-200'
              : task.completed && task.verified
              ? 'bg-green-50 border-success'
              : task.opened && task.verified && !task.error && !task.completed
              ? 'bg-green-50 border-success' // Открыта, проверена, ошибка API (зеленая)
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
                : task.completed && task.verified
                ? 'bg-success text-white'
                : task.opened && task.verified && !task.error && !task.completed
                ? 'bg-success text-white' // Открыта, проверена, ошибка API (зеленая)
                : task.completed && !task.verified
                ? 'bg-warning text-white'
                : 'bg-gray-200 text-gray-600'
            }
          `}
          style={{ cursor: 'default', pointerEvents: 'none' }}
          aria-label={(task.completed && task.verified) || (task.opened && task.verified && !task.error && !task.completed) ? 'Task completed' : task.error ? 'Task error' : `Task ${index + 1}`}
        >
          {task.error ? '❌' : ((task.completed && task.verified) || (task.opened && task.verified && !task.error && !task.completed)) ? '✓' : index + 1}
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
              className="text-sm text-purple-600 hover:text-purple-700 hover:underline break-all block truncate cursor-pointer"
              onClick={(e) => handleLinkClick(e, task.cast_url!)}
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
            disabled={(task.completed && task.verified) || (task.opened && task.verified && !task.error && !task.completed)}
            className={`
              px-4 py-1.5 rounded-lg font-medium text-sm transition-all duration-300
              ${
                task.completed && task.verified
                  ? 'bg-green-500 text-white cursor-not-allowed hover:bg-green-600'
                  : task.opened && task.verified && !task.error && !task.completed
                  ? 'bg-green-500 text-white cursor-not-allowed hover:bg-green-600' // Открыта, проверена, ошибка API (зеленая)
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
            {task.completed && task.verified
              ? 'Completed ✓'
              : task.opened && task.verified && !task.error && !task.completed
              ? 'Completed ✓' // Открыта, проверена, ошибка API (зеленая) 
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

