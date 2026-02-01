// Компонент для синхронизации "Base user" из wagmi address после connect
'use client';

import { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useFarcasterAuth } from '@/contexts/FarcasterAuthContext';
import { addressToUserId, shortAddress } from '@/lib/base-user';
import { resolveNameAndAvatar } from '@/lib/identity';
import { fallbackAvatarDataUri, normalizeAvatarUrl } from '@/lib/media';
import type { Address } from 'viem';
import { useMiniKit } from '@coinbase/onchainkit/minikit';

/**
 * Для Base: создаём "пользователя" из address (без Farcaster SDK)
 */
export const AuthSync: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { user, setUser } = useFarcasterAuth();
  const { context: miniKitContext } = useMiniKit();

  // Сначала пытаемся получить пользователя из MiniKit (даже без подключенного кошелька)
  useEffect(() => {
    const syncUserFromMiniKit = async () => {
      try {
        const mkUser: any = (miniKitContext as any)?.user;
        if (mkUser?.fid) {
          const mkUsername = (mkUser.username || mkUser.displayName || `user_${mkUser.fid}`).toString();
          const mkPfp = normalizeAvatarUrl(mkUser.pfpUrl) || fallbackAvatarDataUri(mkUsername, 96);
          const mkAddress = address || (mkUser.address as string | undefined);

          // Не обновляем, если уже синхронизировано
          if (
            user?.fid === Number(mkUser.fid) &&
            user?.username === mkUsername &&
            user?.pfp_url === mkPfp
          ) {
            return;
          }

          console.log('✅ [AUTH-SYNC] Found user from MiniKit:', {
            fid: mkUser.fid,
            username: mkUsername,
            hasAddress: !!mkAddress,
          });

          setUser({
            fid: Number(mkUser.fid),
            username: mkUsername,
            pfp_url: mkPfp,
            display_name: (mkUser.displayName || mkUsername).toString(),
            address: mkAddress,
          });
        }
      } catch (error) {
        console.error('❌ [AUTH-SYNC] Error syncing from MiniKit:', error);
      }
    };

    syncUserFromMiniKit();
  }, [miniKitContext, user, setUser, address]);

  useEffect(() => {
    const syncUserFromWallet = async () => {
      if (!isConnected || !address) {
        return;
      }

      const id = addressToUserId(address);
      const fallbackName = shortAddress(address);

      // 0) Если MiniKit дал user — используем его как источник истины для username/pfp/fid
      const mkUser: any = (miniKitContext as any)?.user;
      if (mkUser?.fid) {
        const mkUsername = (mkUser.username || mkUser.displayName || fallbackName).toString();
        const mkPfp = normalizeAvatarUrl(mkUser.pfpUrl) || fallbackAvatarDataUri(mkUsername, 96);

        // Не дергаем setUser, если уже синхронизировано
        if (
          user?.address?.toLowerCase() === address.toLowerCase() &&
          user?.fid === Number(mkUser.fid) &&
          user?.username === mkUsername &&
          user?.pfp_url === mkPfp
        ) {
          return;
        }

        setUser({
          fid: Number(mkUser.fid),
          username: mkUsername,
          pfp_url: mkPfp,
          display_name: (mkUser.displayName || mkUsername).toString(),
          address,
        });
        return;
      }

      // Если user уже соответствует текущему адресу и имя уже НЕ fallback — ничего не делаем
      if (user?.address?.toLowerCase() === address.toLowerCase() && user?.username && user.username !== fallbackName) {
        return;
      }

      console.log('🔄 [AUTH-SYNC] Wallet connected, syncing Base user from address...', {
        address,
        id,
      });

      // 1) Ставим fallback-юзера сразу (чтобы UI не был пустым)
      setUser({
        fid: id,
        username: fallbackName,
        pfp_url: fallbackAvatarDataUri(address, 96),
        display_name: fallbackName,
        address,
      });

      // 2) Пытаемся подтянуть ENS/BaseName (и аватар) в фоне
      const { name, avatarUrl } = await resolveNameAndAvatar(address as Address);
      if (!name) return;

      // Если пользователь уже сменил адрес/отключился — не перезаписываем
      if (!isConnected) return;

      setUser({
        fid: id,
        username: name,
        display_name: name,
        pfp_url: normalizeAvatarUrl(avatarUrl) || fallbackAvatarDataUri(name, 96),
        address,
      });
    };

    syncUserFromWallet();
  }, [isConnected, address, user, setUser, miniKitContext]);

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

