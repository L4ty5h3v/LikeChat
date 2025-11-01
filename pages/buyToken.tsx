// Страница покупки токена Миссис Крипто
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Button from '@/components/Button';
import { buyToken, getWalletAddress, checkTokenBalance, getTokenInfo } from '@/lib/web3';
import { markTokenPurchased, getUserProgress } from '@/lib/db-config';
import type { FarcasterUser } from '@/types';

export default function BuyToken() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<FarcasterUser | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [txHash, setTxHash] = useState<string>('');
  const [purchased, setPurchased] = useState(false);
  const [error, setError] = useState<string>('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{
    name: string;
    symbol: string;
    address: string;
    decimals: number;
  } | null>(null);

  useEffect(() => {
    // Проверяем, что код выполняется на клиенте
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('farcaster_user');

      if (!savedUser) {
        router.push('/');
        return;
      }

      const userData = JSON.parse(savedUser);
      setUser(userData);
      
      checkProgress(userData.fid);
      loadWalletInfo();
    }
  }, [router]);

  const checkProgress = async (userFid: number) => {
    const progress = await getUserProgress(userFid);
    
    if (!progress || progress.completed_links.length < 10) {
      router.push('/tasks');
      return;
    }

    if (progress.token_purchased) {
      setPurchased(true);
    }
  };

  const loadWalletInfo = async () => {
    const address = await getWalletAddress();
    if (address) {
      setWalletAddress(address);
      const balance = await checkTokenBalance(address);
      setTokenBalance(balance);
    }
    
    // Загрузить информацию о токене
    const info = await getTokenInfo();
    setTokenInfo(info);
  };

  const handleBuyToken = () => {
    setShowConfirmModal(true);
  };

  const handleBuyInFarcasterWallet = () => {
    // Адрес токена Mrs Crypto
    const tokenAddress = '0x04D388DA70C32FC5876981097c536c51c8d3D236';
    
    // Определяем, мобильное ли устройство
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      // На мобильных устройствах используем deep links
      const warpcastDeepLink = `warpcast://wallet/send?token=${tokenAddress}&amount=1`;
      const farcasterDeepLink = `farcaster://wallet/send?token=${tokenAddress}&amount=1`;
      
      // Пытаемся открыть Warpcast
      window.location.href = warpcastDeepLink;
      
      // Если не работает, через 1 секунду пробуем Farcaster
      setTimeout(() => {
        window.location.href = farcasterDeepLink;
      }, 1000);
      
      // Если и это не работает, через 2 секунды открываем веб-версию
      setTimeout(() => {
        window.open(`https://warpcast.com/`, '_blank');
      }, 2000);
    } else {
      // На десктопе открываем веб-версию Warpcast
      window.open('https://warpcast.com/', '_blank');
    }
  };

  const confirmBuyToken = async () => {
    if (!user) return;

    setLoading(true);
    setError('');
    setShowConfirmModal(false);

    // Автоматически переходим в кошелек Farcaster
    handleBuyInFarcasterWallet();
    
    // Имитируем успешную покупку (так как покупка происходит в кошельке)
    setTimeout(() => {
      setPurchased(true);
      setLoading(false);
      
      // Переход к публикации ссылки через 3 секунды
      setTimeout(() => {
        router.push('/submit');
      }, 3000);
    }, 2000);
  };

  return (
    <Layout title="Multi Like - Buy Token">
      <div className="max-w-4xl mx-auto">
        {/* Заголовок */}
        <div className="text-center mb-8">
          <div className="w-32 h-32 bg-primary bg-opacity-10 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-8xl">💎</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-4">
            Buy Mrs Crypto Token
          </h1>
          <p className="text-xl md:text-2xl text-gray-600">
            Final step before publishing your link
          </p>
        </div>

        {/* Карточка покупки */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          {/* Информация о кошельке */}
          {walletAddress && (
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg text-gray-600">Your wallet:</span>
                <span className="font-mono text-lg font-semibold">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-lg text-gray-600">Token balance:</span>
                <span className="font-semibold text-primary text-xl">
                  {parseFloat(tokenBalance).toFixed(2)} $MCT
                </span>
              </div>
            </div>
          )}

          {/* Детали покупки */}
          <div className="border-2 border-primary border-opacity-30 rounded-xl p-8 mb-6">
            <h3 className="text-3xl font-bold text-gray-900 mb-6 text-center">
              Purchase Details
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xl text-gray-600">Token:</span>
                <span className="font-semibold text-xl">Mrs Crypto ($MCT)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xl text-gray-600">Price:</span>
                <span className="font-bold text-primary text-3xl">$0.10</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xl text-gray-600">You will receive:</span>
                <span className="font-semibold text-xl">≈ 1 $MCT</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-lg text-gray-500 text-center">
                After purchase you will be able to publish your link
              </p>
            </div>
          </div>

          {/* Ошибка */}
          {error && (
            <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6 mb-6">
              <p className="text-red-800 text-xl font-semibold flex items-center gap-2">
                <span className="text-2xl">❌</span>
                {error}
              </p>
            </div>
          )}

          {/* Успешная покупка */}
          {purchased && txHash && (
            <div className="bg-success bg-opacity-10 border-2 border-success rounded-xl p-6 mb-6">
              <div className="text-center mb-4">
                <div className="text-6xl mb-2">✅</div>
                <h3 className="text-2xl font-bold text-success mb-2">
                  Purchase Successful!
                </h3>
                <p className="text-gray-600 mb-4">
                  Token added to your wallet
                </p>
              </div>

              <div className="bg-white rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Transaction hash:</p>
                <p className="font-mono text-sm break-all text-gray-800">
                  {txHash}
                </p>
              </div>

              <p className="text-center text-success font-semibold mt-4">
                Redirecting to link publishing...
              </p>
            </div>
          )}

          {/* Кнопка покупки */}
          {!purchased ? (
            <Button
              onClick={handleBuyToken}
              loading={loading}
              variant="primary"
              fullWidth
              className="text-xl py-5"
            >
              💎 Buy Mrs Crypto Token for $0.10
            </Button>
          ) : (
            <Button
              onClick={() => router.push('/submit')}
              variant="success"
              fullWidth
              className="text-xl py-5"
            >
              Publish Link →
            </Button>
          )}
        </div>

        {/* Модальное окно подтверждения покупки */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">⚠️</span>
                </div>
                
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Confirm Token Purchase
                </h3>
                
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                  <p className="text-gray-700 mb-2">
                    <strong>Token Contract:</strong>
                  </p>
                  <p className="font-mono text-sm bg-white p-2 rounded border break-all">
                    {tokenInfo?.address || '0x04D388DA70C32FC5876981097c536c51c8d3D236'}
                  </p>
                  
                  {tokenInfo && (
                    <div className="mt-3 flex justify-between text-sm">
                      <span className="text-gray-600">Name:</span>
                      <span className="font-semibold">{tokenInfo.name}</span>
                    </div>
                  )}
                  
                  {tokenInfo && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Symbol:</span>
                      <span className="font-semibold">{tokenInfo.symbol}</span>
                    </div>
                  )}
                </div>
                
                <p className="text-gray-600 mb-6">
                  You are about to purchase Mrs Crypto token for <strong>$0.10</strong>. 
                  Clicking "Confirm Purchase" will redirect you to your Farcaster wallet to complete the transaction.
                </p>
                
                <div className="flex gap-3">
                  <Button
                    onClick={() => setShowConfirmModal(false)}
                    variant="secondary"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={confirmBuyToken}
                    variant="primary"
                    className="flex-1"
                  >
                    Confirm Purchase
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Информационный блок */}
        <div className="bg-gradient-to-r from-primary to-pink-500 text-white rounded-2xl p-6">
          <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
            <span>ℹ️</span>
            Important Information
          </h3>
          <ul className="space-y-2 text-sm">
            <li>• 🦄 Purchase will redirect to your Farcaster wallet</li>
            <li>• Token will be sent to your connected wallet</li>
            <li>• Transaction will take a few seconds</li>
            <li>• After purchase you will be able to publish your link</li>
            <li>• Make sure you have enough ETH for network fees</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}

