// Страница покупки токена Миссис Крипто
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Button from '@/components/Button';
import { useAccount, useBalance, useConnect } from 'wagmi';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';
import { useSwapToken, useComposeCast } from '@coinbase/onchainkit/minikit';
import { getTokenInfo, getTokenSalePriceEth, getMCTAmountForPurchase } from '@/lib/web3';
import { markTokenPurchased, getUserProgress } from '@/lib/db-config';
import { formatUnits, parseUnits } from 'viem';
import type { FarcasterUser } from '@/types';

const PURCHASE_AMOUNT_USDC = 0.10; // Покупаем MCT на 0.10 USDC
const USDC_CONTRACT_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC на Base
const MCT_CONTRACT_ADDRESS = '0x04d388da70c32fc5876981097c536c51c8d3d236'; // MCT Token

// Removed: fetchEthUsdPrice() - теперь используем полностью onchain quotes через Uniswap WETH/USDC

export default function BuyToken() {
  const router = useRouter();
  const { address: walletAddress, isConnected } = useAccount();
  const { connect, isPending: isConnecting } = useConnect();
  const { data: mctBalance } = useBalance({
    address: walletAddress,
    token: MCT_CONTRACT_ADDRESS as `0x${string}`,
    query: {
      enabled: !!walletAddress,
    },
  });
  const { data: usdcBalance } = useBalance({
    address: walletAddress,
    token: USDC_CONTRACT_ADDRESS as `0x${string}`,
    query: {
      enabled: !!walletAddress,
    },
  });
  const { swapTokenAsync } = useSwapToken();
  const { composeCastAsync } = useComposeCast();

  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<FarcasterUser | null>(null);
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
  const [tokenPriceEth, setTokenPriceEth] = useState<string | null>(null);
  const [tokenPriceUsd, setTokenPriceUsd] = useState<string | null>(null);
  const [mctAmountForPurchase, setMctAmountForPurchase] = useState<bigint | null>(null);

  // Конфигурация (используем USDC для покупки)
  const useUSDC = true; // false = ETH, true = USDC
  const currencySymbol = useUSDC ? 'USDC' : 'ETH';
  
  const tokenBalance = mctBalance ? formatUnits(mctBalance.value, mctBalance.decimals) : '0';
  
  const parsedEthPrice = tokenPriceEth ? Number(tokenPriceEth) : null;
  const isFree = parsedEthPrice === 0 || parsedEthPrice === null;
  const displayEthPrice = parsedEthPrice !== null && !Number.isNaN(parsedEthPrice) && parsedEthPrice > 0
    ? `${parsedEthPrice.toFixed(6)} ${currencySymbol}`
    : null;
  const displayUsdPrice = tokenPriceUsd && parseFloat(tokenPriceUsd) > 0 ? `$${tokenPriceUsd}` : null;
  const purchasePriceLabel = isFree ? 'Free' : (displayUsdPrice || displayEthPrice || 'the configured price');

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
    
    // Проверяем только, куплен ли уже токен
    if (progress?.token_purchased) {
      setPurchased(true);
    }
  };

  const loadWalletInfo = async () => {
    try {
      // Загружаем информацию о токене (использует Base RPC, безопасно)
      const info = await getTokenInfo();
      setTokenInfo(info);

      // Загружаем цену со смарт-контракта
      const priceEth = await getTokenSalePriceEth();
      setTokenPriceEth(priceEth);

      if (priceEth && parseFloat(priceEth) > 0) {
        // Для USDC цена уже в USD (1 USDC = 1 USD), для ETH конвертируем
        if (useUSDC) {
          // Цена уже в USDC, напрямую используем как USD
          setTokenPriceUsd(parseFloat(priceEth).toFixed(2));
        } else {
          // Для ETH: цена уже должна быть в USDC (onchain quote через Uniswap)
          // Если цена не в USDC, используем как есть или null
          setTokenPriceUsd(null);
        }
      } else {
        // Если цена 0 или не установлена, показываем "Free"
        setTokenPriceUsd('0.00');
        setTokenPriceEth('0');
      }

      // Рассчитываем количество MCT для покупки
      try {
        const amount = await getMCTAmountForPurchase();
        setMctAmountForPurchase(amount);
      } catch (err) {
        console.warn('Could not calculate MCT amount for purchase:', err);
      }
    } catch (err: any) {
      console.error('Error loading wallet info:', err);
      // Устанавливаем значения по умолчанию при ошибке
      setTokenInfo({
        name: 'Mrs Crypto',
        symbol: 'MCT',
        address: MCT_CONTRACT_ADDRESS,
        decimals: 18,
      });
    }
  };

  const handleBuyToken = async () => {
    // Проверяем, что пользователь авторизован
    if (!user) {
      setError('Пожалуйста, авторизуйтесь через Farcaster');
      return;
    }

    // Проверяем подключение кошелька
    if (!walletAddress || !isConnected) {
      setError('Пожалуйста, подключите кошелек для покупки токена');
      return;
    }

    // Проверяем баланс USDC
    if (useUSDC && usdcBalance) {
      const usdcAmount = parseUnits(PURCHASE_AMOUNT_USDC.toString(), 6); // USDC имеет 6 decimals
      if (usdcBalance.value < usdcAmount) {
        setError(`Недостаточно USDC. Требуется: ${PURCHASE_AMOUNT_USDC} USDC`);
        return;
      }
    }
    
    // Показываем модальное окно подтверждения
    setShowConfirmModal(true);
  };

  const confirmBuyToken = async () => {
    if (!user) {
      setError('Пользователь не авторизован');
      return;
    }

    if (!walletAddress) {
      setError('Кошелек не подключен');
      return;
    }

    setLoading(true);
    setError('');
    setShowConfirmModal(false);

    try {
      // Вычисляем количество USDC для покупки (в wei, USDC имеет 6 decimals)
      const usdcAmountWei = parseUnits(PURCHASE_AMOUNT_USDC.toString(), 6);
      const usdcAmountStr = usdcAmountWei.toString();

      // Используем useSwapToken для one-tap swap через Farcaster
      console.log('🔄 Starting token swap via Farcaster SDK for FID:', user.fid);
      console.log(`💱 Swapping ${PURCHASE_AMOUNT_USDC} USDC to MCT...`);

      const result = await swapTokenAsync({
        sellToken: `eip155:8453/erc20:${USDC_CONTRACT_ADDRESS}`, // USDC на Base
        buyToken: `eip155:8453/erc20:${MCT_CONTRACT_ADDRESS}`, // MCT Token на Base
        sellAmount: usdcAmountStr, // 0.10 USDC в wei (6 decimals)
      });

      console.log('📊 Swap result:', result);

      // useSwapToken открывает swap форму в Farcaster кошельке
      // Пользователь завершает swap в кошельке
      // После завершения баланс обновится автоматически через wagmi hooks

      // Показываем сообщение о завершении swap
      setError('');
      setLoading(false);

      // Сохраняем старый баланс для проверки
      const oldBalance = parseFloat(tokenBalance);

      // Ждем завершения swap (проверяем баланс через 10 секунд)
      setTimeout(async () => {
        try {
          // Баланс должен обновиться автоматически через wagmi hooks
          // Проверяем, увеличился ли баланс
          if (mctBalance) {
            const newBalance = parseFloat(formatUnits(mctBalance.value, mctBalance.decimals));
            
            if (newBalance > oldBalance) {
              // Баланс увеличился - покупка успешна
              setPurchased(true);
              
              // Отметить покупку в базе данных
              try {
                await markTokenPurchased(user.fid);
                console.log('✅ Token purchase marked in database');
              } catch (dbError) {
                console.error('Error marking token purchase in DB:', dbError);
              }
              
              // Публикуем cast о покупке (опционально)
              try {
                await composeCastAsync({
                  text: `🎉 Just swapped ${PURCHASE_AMOUNT_USDC} USDC for $MCT on Base!\n\n#MultiLike #Base`,
                });
              } catch (castError) {
                console.warn('Could not publish cast:', castError);
              }
              
              // Переход к публикации ссылки через 3 секунды
              setTimeout(() => {
                router.push('/submit');
              }, 3000);
            } else {
              setError('Пожалуйста, завершите swap в кошельке. После завершения обновите страницу.');
            }
          }
        } catch (balanceError) {
          console.warn('Could not check token balance:', balanceError);
          setError('Пожалуйста, завершите swap в кошельке. После завершения обновите страницу.');
        }
      }, 10000); // 10 секунд на завершение swap

    } catch (err: any) {
      console.error('❌ Error in confirmBuyToken:', err);
      let errorMessage = err.message || 'Неожиданная ошибка при покупке токена';
      setError(errorMessage);
      setLoading(false);
    }
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
            Purchase token to unlock features
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

          {!walletAddress && (
            <div className="mb-6">
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6 text-center">
                <p className="text-yellow-800 text-lg font-semibold mb-4">
                  🔗 Connect your Farcaster wallet
                </p>
                <Button
                  onClick={() => connect({ connector: farcasterMiniApp() })}
                  loading={isConnecting}
                  variant="primary"
                  fullWidth
                  className="text-lg py-4"
                >
                  {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </Button>
                <p className="text-yellow-700 text-sm mt-3">
                  Your wallet will connect through Farcaster Mini App
                </p>
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
                <div className="text-right">
                  <span className="font-bold text-primary text-3xl block">
                    {isFree ? 'Free' : (displayUsdPrice || displayEthPrice || '—')}
                  </span>
                  {!isFree && useUSDC && tokenPriceEth && (
                    <span className="text-sm text-gray-500">
                      {parseFloat(tokenPriceEth).toFixed(6)} USDC
                    </span>
                  )}
                  {!isFree && !useUSDC && displayEthPrice && (
                    <span className="text-sm text-gray-500">
                      {displayEthPrice}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xl text-gray-600">You will receive:</span>
                <span className="font-semibold text-xl">
                  {mctAmountForPurchase 
                    ? `${formatUnits(mctAmountForPurchase, 18).slice(0, 10)} $MCT`
                    : (tokenPriceEth && parseFloat(tokenPriceEth) > 0 
                      ? `${(PURCHASE_AMOUNT_USDC / parseFloat(tokenPriceEth)).toFixed(6)} $MCT`
                      : 'Calculating...')}
                </span>
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
                  0.10 MCT tokens added to your wallet
                </p>
              </div>

              <div className="bg-white rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-600 mb-1">Transaction hash:</p>
                <a
                  href={`https://basescan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm break-all text-primary hover:text-primary-dark underline"
                >
                  {txHash}
                </a>
                <p className="text-xs text-gray-500 mt-1">
                  View on BaseScan ↗
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
              disabled={loading}
              variant="primary"
              fullWidth
              className="text-xl py-5"
            >
              💎 Buy Mrs Crypto Token{displayUsdPrice ? ` for ${displayUsdPrice}` : ' (Free)'}
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
                  You are about to purchase Mrs Crypto token. 
                  Clicking "Confirm Purchase" will verify your purchase through Farcaster API.
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
            <li>• 🦄 Purchase 0.10 MCT through Base network smart contract</li>
            <li>• Payment method: USDC (price pulled from smart contract)</li>
            <li>• Network will automatically switch to Base if needed</li>
            <li>• Token will be sent to your connected wallet</li>
            <li>• You will need to approve USDC spending first, then purchase</li>
            <li>• After purchase you will be able to publish your link</li>
            <li>• Make sure you have enough USDC on Base for purchase and ETH for gas fees</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}

