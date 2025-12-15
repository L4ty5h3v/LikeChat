// Компонент для синхронизации "Base user" из wagmi address после connect
'use client';

import { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useFarcasterAuth } from '@/contexts/FarcasterAuthContext';
import { addressToUserId, shortAddress } from '@/lib/base-user';
import { resolveNameAndAvatar } from '@/lib/identity';
import type { Address } from 'viem';

/**
 * Для Base: создаём "пользователя" из address (без Farcaster SDK)
 */
export const AuthSync: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { user, setUser } = useFarcasterAuth();

  useEffect(() => {
    const syncUserFromWallet = async () => {
      if (!isConnected || !address) {
        return;
      }

      const id = addressToUserId(address);
      const fallbackName = shortAddress(address);

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
        pfp_url: `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`,
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
        pfp_url: avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`,
        address,
      });
    };

    syncUserFromWallet();
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

