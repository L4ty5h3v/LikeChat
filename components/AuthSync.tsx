// Компонент для синхронизации "Base user" из wagmi address после connect
'use client';

import { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useFarcasterAuth } from '@/contexts/FarcasterAuthContext';
import { addressToUserId, shortAddress } from '@/lib/base-user';

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

      // Если user уже соответствует текущему адресу — ничего не делаем
      if (user?.address?.toLowerCase() === address.toLowerCase()) return;

      const id = addressToUserId(address);
      const name = shortAddress(address);

      console.log('🔄 [AUTH-SYNC] Wallet connected, syncing Base user from address...', {
        address,
        id,
      });

      setUser({
        fid: id,
        username: name,
        pfp_url: `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`,
        display_name: name,
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

