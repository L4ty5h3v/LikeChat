// Страница покупки токена Миссис Крипто
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Button from '@/components/Button';
import { useAccount, useBalance, useConnect, useBlockNumber } from 'wagmi';
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
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapInitiatedAt, setSwapInitiatedAt] = useState<number | null>(null);
  const [oldBalanceBeforeSwap, setOldBalanceBeforeSwap] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [swapTimeoutId, setSwapTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [lastCheckedBlock, setLastCheckedBlock] = useState<bigint | null>(null);
  const [blocksSinceSwap, setBlocksSinceSwap] = useState(0);
  const MAX_RETRIES = 3;
  const BLOCKS_TO_CHECK = 4; // Проверяем каждые 4 блока (~12 секунд на Base)
  
  // Real-time block listener для проверки баланса
  const { data: blockNumber } = useBlockNumber({
    watch: isSwapping, // Включаем только при swap
    query: {
      enabled: isSwapping && !!walletAddress,
    },
  });
  
  const { data: mctBalance, refetch: refetchMCTBalance } = useBalance({
    address: walletAddress,
    token: MCT_CONTRACT_ADDRESS as `0x${string}`,
    query: {
      enabled: !!walletAddress,
      // Базовое обновление каждые 30 секунд, но реальное обновление через блоки
      refetchInterval: false, // Отключаем интервальное обновление, используем блоки
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
    
    // One-tap: сразу запускаем swap без модального окна
    await confirmBuyToken();
  };

  // Обработка ошибок swap с retry логикой и конкретными подсказками
  const handleSwapError = (err: any, isTimeout: boolean = false) => {
    console.error('❌ Error in confirmBuyToken:', err);
    
    // Очищаем таймаут если есть
    if (swapTimeoutId) {
      clearTimeout(swapTimeoutId);
      setSwapTimeoutId(null);
    }
    
    let errorMessage = err?.message || err?.reason || 'Неожиданная ошибка при покупке токена';
    let errorType: 'user_rejection' | 'network' | 'insufficient_balance' | 'insufficient_funds' | 'slippage' | 'timeout' | 'unknown' | 'retryable' = 'unknown';
    let helpfulMessage = '';
    
    // Определяем тип ошибки с конкретными подсказками
    const errorLower = errorMessage.toLowerCase();
    
    if (errorLower.includes('user rejected') || 
        errorLower.includes('cancel') ||
        errorLower.includes('denied') ||
        errorLower.includes('rejected')) {
      errorType = 'user_rejection';
      errorMessage = 'Транзакция отменена пользователем';
      helpfulMessage = '';
    } else if (errorLower.includes('insufficient funds') || 
               errorLower.includes('insufficient balance') ||
               (errorLower.includes('insufficient') && errorLower.includes('usdc'))) {
      errorType = 'insufficient_funds';
      errorMessage = `Недостаточно USDC для покупки`;
      helpfulMessage = `💡 Добавьте больше USDC в кошелек. Требуется минимум ${PURCHASE_AMOUNT_USDC} USDC + ETH для gas`;
    } else if (errorLower.includes('insufficient') || 
               errorLower.includes('balance') ||
               (errorLower.includes('amount') && !errorLower.includes('slippage'))) {
      errorType = 'insufficient_balance';
      errorMessage = 'Недостаточно средств для выполнения swap';
      helpfulMessage = `💡 Проверьте баланс USDC в кошельке. Доступно: ${usdcBalance ? formatUnits(usdcBalance.value, usdcBalance.decimals) : '0'} USDC`;
    } else if (errorLower.includes('slippage') || 
               errorLower.includes('price impact') ||
               errorLower.includes('execution reverted: dsr') ||
               errorLower.includes('execution reverted: spc')) {
      errorType = 'slippage';
      errorMessage = 'Slippage tolerance превышен';
      helpfulMessage = '💡 Увеличьте slippage tolerance в настройках swap или попробуйте позже, когда ликвидность улучшится';
    } else if (errorLower.includes('timeout') || 
               errorLower.includes('network') || 
               errorLower.includes('connection') ||
               errorLower.includes('fetch') ||
               isTimeout) {
      errorType = 'timeout';
      errorMessage = isTimeout 
        ? 'Timeout: swap не завершился за 30 секунд' 
        : 'Ошибка сети';
      helpfulMessage = '💡 Проверьте подключение к интернету и попробуйте снова';
    } else if (errorLower.includes('gas') || 
               errorLower.includes('fee') ||
               (errorLower.includes('execution') && !errorLower.includes('slippage')) ||
               (errorLower.includes('revert') && !errorLower.includes('slippage'))) {
      errorType = 'retryable';
      if (retryCount < MAX_RETRIES) {
        errorMessage = `Ошибка выполнения: ${errorMessage}`;
        helpfulMessage = '💡 Попробуйте еще раз - это может быть временная проблема с сетью';
      } else {
        errorMessage = `Ошибка выполнения после ${MAX_RETRIES} попыток: ${errorMessage}`;
        helpfulMessage = '💡 Обновите страницу и попробуйте снова';
      }
    }
    
    setLastError(errorMessage);
    setLoading(false);
    setIsSwapping(false);
    setSwapInitiatedAt(null);
    setOldBalanceBeforeSwap(null);
    setLastCheckedBlock(null);
    setBlocksSinceSwap(0);
    
    // Показываем ошибку пользователю с подсказками
    const finalMessage = helpfulMessage 
      ? `${errorMessage}\n\n${helpfulMessage}` 
      : errorMessage;
    
    if (errorType === 'user_rejection') {
      setError(finalMessage);
      setRetryCount(0);
    } else if (errorType === 'timeout' || errorType === 'retryable') {
      if (retryCount < MAX_RETRIES) {
        setError(`${finalMessage}\n\n(Попытка ${retryCount + 1}/${MAX_RETRIES})`);
      } else {
        setError(finalMessage);
      }
    } else {
      setError(finalMessage);
      setRetryCount(0);
    }
  };

  // Функция для retry с exponential backoff
  const handleRetry = () => {
    if (retryCount >= MAX_RETRIES) {
      setError('Превышено максимальное количество попыток. Пожалуйста, обновите страницу и попробуйте снова.');
      setRetryCount(0);
      return;
    }
    
    // Exponential backoff: 1-я сразу (0с), 2-я через 2с, 3-я через 5с
    const backoffDelays = [0, 2000, 5000];
    const delay = backoffDelays[retryCount] || 5000;
    
    setRetryCount(prev => prev + 1);
    console.log(`🔄 Retry attempt ${retryCount + 1}/${MAX_RETRIES} after ${delay}ms delay`);
    
    if (delay === 0) {
      // Первая попытка сразу
      confirmBuyToken(true);
    } else {
      // Последующие попытки с задержкой
      setTimeout(() => {
        confirmBuyToken(true);
      }, delay);
    }
  };

  // Real-time баланс через блоки: проверяем каждые 3-5 блоков
  useEffect(() => {
    if (!isSwapping || !blockNumber || !mctBalance || oldBalanceBeforeSwap === null) return;

    // Инициализируем последний проверенный блок
    if (lastCheckedBlock === null) {
      setLastCheckedBlock(blockNumber);
      setBlocksSinceSwap(0);
      return;
    }

    // Подсчитываем блоки с момента swap
    const blocksPassed = Number(blockNumber - lastCheckedBlock);
    setBlocksSinceSwap(prev => prev + blocksPassed);
    setLastCheckedBlock(blockNumber);

    // Проверяем баланс каждые BLOCKS_TO_CHECK блоков
    if (blocksSinceSwap >= BLOCKS_TO_CHECK) {
      console.log(`🔍 Checking balance after ${blocksSinceSwap} blocks (block ${blockNumber})...`);
      refetchMCTBalance();
      setBlocksSinceSwap(0); // Сбрасываем счетчик после проверки
    }
  }, [blockNumber, isSwapping, mctBalance, oldBalanceBeforeSwap, lastCheckedBlock, blocksSinceSwap, refetchMCTBalance]);

  // Отслеживаем изменения баланса после проверки
  useEffect(() => {
    if (!isSwapping || !mctBalance || oldBalanceBeforeSwap === null) return;

    const newBalance = parseFloat(formatUnits(mctBalance.value, mctBalance.decimals));
    
    // Если баланс увеличился, swap завершен успешно
    if (newBalance > oldBalanceBeforeSwap) {
      console.log('✅ Balance increased! Swap completed successfully');
      console.log(`📊 Balance: ${oldBalanceBeforeSwap} → ${newBalance} MCT`);
      setIsSwapping(false);
      setSwapInitiatedAt(null);
      setOldBalanceBeforeSwap(null);
      setLastCheckedBlock(null);
      setBlocksSinceSwap(0);
      setPurchased(true);
      
      // Отметить покупку в базе данных
      if (user) {
        markTokenPurchased(user.fid).then(() => {
          console.log('✅ Token purchase marked in database');
        }).catch((dbError) => {
          console.error('Error marking token purchase in DB:', dbError);
        });
        
        // Публикуем cast о покупке (опционально)
        composeCastAsync({
          text: `🎉 Just swapped ${PURCHASE_AMOUNT_USDC} USDC for $MCT on Base!\n\n#MultiLike #Base`,
        }).catch((castError) => {
          console.warn('Could not publish cast:', castError);
        });
      }
      
      // Переход к публикации ссылки через 3 секунды
      setTimeout(() => {
        router.push('/submit');
      }, 3000);
    }
  }, [mctBalance, isSwapping, oldBalanceBeforeSwap, user, router, composeCastAsync]);

  const confirmBuyToken = async (isRetry: boolean = false) => {
    if (!user) {
      setError('Пользователь не авторизован');
      setLastError('Пользователь не авторизован');
      return;
    }

    if (!walletAddress) {
      setError('Кошелек не подключен');
      setLastError('Кошелек не подключен');
      return;
    }

    // Проверяем баланс USDC перед каждой попыткой
    if (useUSDC && usdcBalance) {
      const usdcAmount = parseUnits(PURCHASE_AMOUNT_USDC.toString(), 6);
      if (usdcBalance.value < usdcAmount) {
        const errorMsg = `Недостаточно USDC. Требуется: ${PURCHASE_AMOUNT_USDC} USDC, доступно: ${formatUnits(usdcBalance.value, usdcBalance.decimals)}`;
        setError(errorMsg);
        setLastError(errorMsg);
        return;
      }
    }

    setLoading(true);
    setError('');
    setLastError(null);

    try {
      // Вычисляем количество USDC для покупки (в wei, USDC имеет 6 decimals)
      const usdcAmountWei = parseUnits(PURCHASE_AMOUNT_USDC.toString(), 6);
      const usdcAmountStr = usdcAmountWei.toString();

      // Сохраняем текущий баланс для сравнения
      const currentBalance = mctBalance ? parseFloat(formatUnits(mctBalance.value, mctBalance.decimals)) : 0;
      setOldBalanceBeforeSwap(currentBalance);

      // Используем useSwapToken для one-tap swap через Farcaster
      const attemptInfo = isRetry ? ` (Retry ${retryCount}/${MAX_RETRIES})` : '';
      console.log(`🔄 Starting token swap via Farcaster SDK for FID: ${user.fid}${attemptInfo}`);
      console.log(`💱 Swapping ${PURCHASE_AMOUNT_USDC} USDC to MCT...`);
      console.log(`📊 Current MCT balance: ${currentBalance}`);

      // Запускаем swap и начинаем отслеживать баланс
      setIsSwapping(true);
      setSwapInitiatedAt(Date.now());

      // Таймаут для swap - 30 секунд
      const timeoutId = setTimeout(() => {
        console.warn('⏱️ Swap timeout: 30 seconds elapsed without response');
        handleSwapError(new Error('Timeout: swap не завершился за 30 секунд'), true);
      }, 30000);
      setSwapTimeoutId(timeoutId);

      let result;
      try {
        result = await swapTokenAsync({
          sellToken: `eip155:8453/erc20:${USDC_CONTRACT_ADDRESS}`, // USDC на Base
          buyToken: `eip155:8453/erc20:${MCT_CONTRACT_ADDRESS}`, // MCT Token на Base
          sellAmount: usdcAmountStr, // 0.10 USDC в wei (6 decimals)
        });
        // Очищаем таймаут при успешном запуске
        if (timeoutId) {
          clearTimeout(timeoutId);
          setSwapTimeoutId(null);
        }
      } catch (swapError) {
        // Очищаем таймаут при ошибке
        if (timeoutId) {
          clearTimeout(timeoutId);
          setSwapTimeoutId(null);
        }
        throw swapError;
      }

      console.log('📊 Swap result:', result);

      // useSwapToken открывает swap форму в Farcaster кошельке
      // Пользователь завершает swap в кошельке
      // После завершения баланс обновится автоматически через wagmi hooks (refetchInterval)
      
      setLoading(false);
      setRetryCount(0); // Сбрасываем счетчик при успешном запуске swap
      
      // Начинаем периодически обновлять баланс для проверки завершения swap
      refetchMCTBalance();

    } catch (err: any) {
      handleSwapError(err, false);
    }
  };

  // Очистка таймаутов при размонтировании
  useEffect(() => {
    return () => {
      if (swapTimeoutId) {
        clearTimeout(swapTimeoutId);
      }
    };
  }, [swapTimeoutId]);

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

          {/* Ошибка с retry */}
          {error && (
            <div className="bg-gold-50 border-2 border-gold-300 rounded-xl p-6 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">❌</span>
                <div className="flex-1">
                  <p className="text-gold-800 text-xl font-semibold mb-2 whitespace-pre-line">
                {error}
              </p>
                  {/* Показываем retry только для определенных типов ошибок и если не превышен лимит */}
                  {lastError && 
                   !lastError.includes('отменена пользователем') && 
                   !lastError.includes('Недостаточно USDC') &&
                   !lastError.includes('Slippage') &&
                   retryCount < MAX_RETRIES && (
                    <div className="mt-4">
                      <Button
                        onClick={handleRetry}
                        variant="secondary"
                        disabled={loading || isSwapping}
                        className="mr-3"
                      >
                        🔄 Попробовать снова ({retryCount + 1}/{MAX_RETRIES})
                      </Button>
                      <Button
                        onClick={() => {
                          setError('');
                          setLastError(null);
                          setRetryCount(0);
                        }}
                        variant="secondary"
                        className="bg-gray-200"
                      >
                        ✖️ Закрыть
                      </Button>
                    </div>
                  )}
                  {retryCount >= MAX_RETRIES && (
                    <div className="mt-4">
                      <p className="text-gold-600 text-sm mb-2">
                        Превышено максимальное количество попыток. Обновите страницу и попробуйте снова.
                      </p>
                      <Button
                        onClick={() => window.location.reload()}
                        variant="secondary"
                      >
                        🔄 Обновить страницу
                      </Button>
                    </div>
                  )}
                </div>
              </div>
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
              loading={loading || isSwapping}
              disabled={loading || isSwapping || !walletAddress}
              variant="primary"
              fullWidth
              className="text-xl py-5"
            >
              {isSwapping 
                ? '⏳ Waiting for swap to complete...' 
                : loading 
                  ? '🔄 Processing...' 
                  : `💎 Buy Mrs Crypto Token${displayUsdPrice ? ` for ${displayUsdPrice}` : ' (Free)'}`}
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
          
          {/* Индикатор ожидания завершения swap */}
          {isSwapping && (
            <div className="bg-gradient-to-r from-emerald-50 to-amber-50 border-2 border-emerald-300 rounded-xl p-6 mt-4 text-center">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600"></div>
                <p className="bg-gradient-to-r from-emerald-700 to-emerald-800 bg-clip-text text-transparent text-lg font-semibold">
                  Waiting for swap to complete...
                </p>
              </div>
              <p className="text-emerald-700 text-sm font-medium">
                Please confirm the transaction in your Farcaster wallet. The balance will update automatically.
              </p>
            </div>
          )}
        </div>

        {/* Модальное окно подтверждения покупки - убрано для one-tap UX */}

        {/* Информационный блок */}
        <div className="bg-gradient-to-r from-emerald-600 to-amber-600 text-white rounded-2xl p-6 shadow-xl shadow-emerald-500/30">
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

