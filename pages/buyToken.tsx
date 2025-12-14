// Страница покупки MCT на $0.10 (Base-only, без Farcaster/OnchainKit)
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Button from '@/components/Button';
import { useAccount, useConnect } from 'wagmi';
import { useFarcasterAuth } from '@/contexts/FarcasterAuthContext';
import { buyToken } from '@/lib/web3';

export default function BuyTokenPage() {
  const router = useRouter();
  const { user, isInitialized } = useFarcasterAuth();
  const { address, isConnected, chainId } = useAccount();
  const { connectAsync, connectors, isPending: isConnecting } = useConnect();

  const [loading, setLoading] = useState(false);
  const [tokenPurchased, setTokenPurchased] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!isInitialized) return;
    if (!user) {
      router.push('/');
      return;
    }
    // подтягиваем прогресс
    (async () => {
      try {
        const res = await fetch(`/api/user-progress?userFid=${user.fid}&t=${Date.now()}`);
        const json = await res.json();
        setTokenPurchased(!!json?.progress?.token_purchased);
      } catch {
        // ignore
      }
    })();
  }, [isInitialized, user, router]);

  const handleConnect = async () => {
    setError('');
    const connector = connectors?.[0];
    if (!connector) {
      setError('Нет доступных коннекторов кошелька. Установите Coinbase Wallet или MetaMask.');
      return;
    }
    await connectAsync({ connector });
  };

  const handleBuy = async () => {
    if (!user) return;
    setError('');
    setLoading(true);
    try {
      if (!isConnected || !address) {
        throw new Error('Сначала подключите кошелёк.');
      }
      if (chainId && chainId !== 8453) {
        throw new Error('Переключите сеть на Base (8453).');
      }

      const result = await buyToken(user.fid);
      if (!result.success) {
        throw new Error(result.error || 'Не удалось купить MCT');
      }

      // сохраняем прогресс на сервере
      await fetch('/api/mark-token-purchased', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userFid: user.fid, txHash: result.txHash }),
      });

      setTokenPurchased(true);
      router.push('/tasks');
    } catch (e: any) {
      setError(e?.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Buy MCT">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-black mb-4">BUY MCT</h1>
        <p className="text-gray-700 mb-8">
          Нужно купить <b>$0.10</b> MCT, чтобы открыть публикацию.
        </p>

        {!isConnected ? (
          <Button onClick={handleConnect} disabled={isConnecting}>
            {isConnecting ? 'CONNECTING…' : 'CONNECT WALLET'}
          </Button>
        ) : (
          <div className="mb-6 text-sm text-gray-700">
            Wallet: <b>{address}</b>
          </div>
        )}

        <div className="mt-6">
          <Button onClick={handleBuy} disabled={loading || tokenPurchased || !isConnected}>
            {tokenPurchased ? 'Уже куплено' : loading ? 'ПОКУПКА…' : 'Купить $0.10 MCT'}
          </Button>
        </div>

        {error && <div className="mt-6 text-red-600 font-bold whitespace-pre-line">{error}</div>}
      </div>
    </Layout>
  );
}


