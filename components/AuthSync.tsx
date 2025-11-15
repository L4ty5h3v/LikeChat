// Компонент для синхронизации авторизации с MiniKit SDK после connect
'use client';

import { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useFarcasterAuth } from '@/contexts/FarcasterAuthContext';

/**
 * Компонент для синхронизации user из MiniKit SDK после подключения кошелька
 * Вызывается в _app.tsx для автоматического обновления user при connect
 */
export const AuthSync: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { user, setUser } = useFarcasterAuth();

  useEffect(() => {
    const syncUserFromSDK = async () => {
      // Проверяем, что кошелек подключен и user еще не загружен или нужно обновить
      if (!isConnected || !address) {
        return;
      }

      // Если user уже есть с валидным fid, не обновляем
      if (user && user.fid && typeof user.fid === 'number' && user.fid > 0) {
        console.log('ℹ️ [AUTH-SYNC] User already loaded, skipping sync');
        return;
      }

      try {
        console.log('🔄 [AUTH-SYNC] Wallet connected, syncing user from SDK...', {
          address,
          isConnected,
        });

        const isInFarcasterFrame = typeof window !== 'undefined' && window.self !== window.top;
        if (!isInFarcasterFrame) {
          console.log('ℹ️ [AUTH-SYNC] Not in Farcaster frame, skipping SDK sync');
          return;
        }

        // Импортируем SDK
        const { sdk } = await import('@farcaster/miniapp-sdk');
        const context = await sdk.context;

        console.log('📊 [AUTH-SYNC] SDK context:', {
          hasContext: !!context,
          hasUser: !!context?.user,
          userFid: context?.user?.fid,
        });

        // Если SDK предоставил user с fid, username и pfp - сохраняем
        if (context?.user && context.user.fid) {
          const sdkUser = {
            fid: Number(context.user.fid),
            username: context.user.username || `user_${context.user.fid}`,
            pfp_url:
              (context.user as any).pfp?.url ||
              (context.user as any).pfpUrl ||
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${context.user.fid}`,
            display_name:
              (context.user as any).displayName ||
              context.user.username ||
              `User ${context.user.fid}`,
          };

          console.log('✅ [AUTH-SYNC] User from SDK after connect:', {
            fid: sdkUser.fid,
            username: sdkUser.username,
            hasPfp: !!sdkUser.pfp_url,
          });

          // Сохраняем через контекст (автоматически сохранит в localStorage)
          setUser(sdkUser);

          console.log('✅ [AUTH-SYNC] User synced and saved to localStorage');
        } else {
          console.warn('⚠️ [AUTH-SYNC] SDK context does not contain valid user data');
        }
      } catch (error: any) {
        console.error('❌ [AUTH-SYNC] Error syncing user from SDK:', error);
      }
    };

    syncUserFromSDK();
  }, [isConnected, address, user, setUser]);

  // Также слушаем события disconnect
  useEffect(() => {
    const handleDisconnect = () => {
      console.log('🔌 [AUTH-SYNC] Wallet disconnected, clearing user...');
      // Не очищаем user автоматически при disconnect кошелька,
      // так как user может быть получен из другого источника
      // Очистка будет выполнена только через logout()
    };

    // Wagmi не предоставляет прямого события disconnect, но можно слушать изменения isConnected
    // Для явной очистки используйте logout() функцию из контекста
  }, [isConnected]);

  return null; // Компонент не рендерит ничего
};

