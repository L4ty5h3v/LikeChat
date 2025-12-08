// Страница покупки токена Миссис Крипто
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Layout from '@/components/Layout';
import Button from '@/components/Button';
import { useAccount, useBalance, useConnect, useBlockNumber } from 'wagmi';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';
import { useSwapToken } from '@coinbase/onchainkit/minikit';
import { getTokenInfo, getTokenSalePriceEth, getMCTAmountForPurchase } from '@/lib/web3';
import { markTokenPurchased, getUserProgress } from '@/lib/db-config';
import { formatUnits, parseUnits } from 'viem';
import type { FarcasterUser } from '@/types';
import { sendTokenPurchaseNotification } from '@/lib/farcaster-notifications';
import { useFarcasterAuth } from '@/contexts/FarcasterAuthContext';

const PURCHASE_AMOUNT_USDC = 0.10; // Покупаем MCT на 0.10 USDC
const USDC_CONTRACT_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC на Base (6 decimals) - правильный адрес
const MCT_CONTRACT_ADDRESS = '0x04d388da70c32fc5876981097c536c51c8d3d236'; // MCT Token

// Публиковать cast в Farcaster с tx hash после успешного swap для social proof
async function publishSwapCastWithTxHash(
  txHash: string,
  mctReceived: number,
  usdcSpent: number,
  username?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (typeof window === 'undefined') {
      return {
        success: false,
        error: 'SDK доступен только на клиенте',
      };
    }

    const isInFarcasterFrame = window.self !== window.top;
    if (!isInFarcasterFrame) {
      console.log('ℹ️ [CAST] Not in Farcaster frame, skipping cast publication');
      return {
        success: false,
        error: 'Not in Farcaster Mini App',
      };
    }

    const { sdk } = await import('@farcaster/miniapp-sdk');

    if (!sdk || !sdk.actions) {
      console.warn('⚠️ [CAST] SDK or actions not available');
      return {
        success: false,
        error: 'SDK actions not available',
      };
    }

    // Формируем текст cast с tx hash для social proof
    const txUrl = `https://basescan.org/tx/${txHash}`;
    const castText = `❤️ Just swapped ${usdcSpent} USDC for ${mctReceived.toFixed(4)} MCT tokens!\n\n${txUrl}\n\n#MCT #Base #DeFi`;

    // Используем composeCast если доступен, иначе fallback на openUrl
    if (typeof (sdk.actions as any).composeCast === 'function') {
      await (sdk.actions as any).composeCast({
        text: castText,
        embeds: [txUrl],
      });
      console.log('✅ [CAST] Swap cast published via composeCast with tx hash');
      return { success: true };
    } else if (sdk.actions.openUrl) {
      // Fallback: открываем Compose с предзаполненным текстом
      const farcasterUrl = `https://farcaster.xyz/~/compose?text=${encodeURIComponent(castText)}`;
      await sdk.actions.openUrl({ url: farcasterUrl });
      console.log('✅ [CAST] Swap cast compose opened via openUrl with tx hash');
      return { success: true };
    }

    return {
      success: false,
      error: 'No compose method available',
    };
  } catch (error: any) {
    console.error('❌ [CAST] Error publishing swap cast:', error);
    return {
      success: false,
      error: error?.message || 'Failed to publish cast',
    };
  }
}

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
  const [swapWaitTime, setSwapWaitTime] = useState(0);
  const [isFirstSwapCall, setIsFirstSwapCall] = useState(true); // Отслеживаем первый вызов
  const MAX_RETRIES = 3;
  const BLOCKS_TO_CHECK = 4; // Проверяем каждые 4 блока (~12 секунд на Base)
  const SWAP_TIMEOUT_MS = 60000; // Увеличиваем таймаут до 60 секунд
  
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
  // Получаем весь объект из useSwapToken для установки параметров
  const swapHookResult = useSwapToken();
  const swapTokenAsync = typeof swapHookResult === 'function' 
    ? swapHookResult 
    : (swapHookResult as any)?.swapTokenAsync;
  

  const [loading, setLoading] = useState(false);
  const { user, isLoading: authLoading, isInitialized } = useFarcasterAuth(); // Используем контекст вместо localStorage
  const [txHash, setTxHash] = useState<string>('');
  const [purchased, setPurchased] = useState(false);
  const [canPublishLink, setCanPublishLink] = useState(false);
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
    if (typeof window === 'undefined') return;
    
    // Ждём инициализации авторизации
    if (!isInitialized) {
      console.log('⏳ [BUY-TOKEN] Waiting for auth initialization...');
      return;
    }
    
    // Проверяем наличие user
    if (!user || !user.fid) {
      console.error('❌ [BUY-TOKEN] No user found, redirecting to home...');
      router.push('/');
      return;
    }

    console.log('✅ [BUY-TOKEN] User loaded:', {
      fid: user.fid,
      username: user.username,
    });
    
    checkProgress(user.fid);
    loadWalletInfo();
  }, [router, user, isInitialized]);

  // Перепроверяем статус покупки при изменении баланса
  useEffect(() => {
    if (user?.fid && mctBalance !== undefined) {
      // Ждем, пока баланс загрузится (может быть null или объект)
      // НЕ вызываем checkProgress здесь, чтобы не перезаписывать состояние purchased
      // checkProgress уже вызывается в основном useEffect при загрузке страницы
      console.log('🔍 [BUYTOKEN] Balance changed, but not rechecking progress to avoid overwriting purchased state');
    }
  }, [tokenBalance, mctBalance, user?.fid]);

  const checkProgress = async (userFid: number) => {
    try {
      // Проверяем, что код выполняется на клиенте
      if (typeof window === 'undefined') return;
      
      const progress = await getUserProgress(userFid);
      
      // Проверяем баланс MCT токенов только для логирования
      let currentBalance = 0;
      if (mctBalance && mctBalance.value && mctBalance.decimals) {
        try {
          currentBalance = parseFloat(formatUnits(mctBalance.value, mctBalance.decimals));
        } catch (balanceError) {
          console.warn('⚠️ [BUYTOKEN] Error parsing balance:', balanceError);
          currentBalance = 0;
        }
      }
      
      console.log('🔍 [BUYTOKEN] checkProgress:', {
        userFid,
        tokenPurchasedInDB: progress?.token_purchased,
        currentBalance,
        willShowBuyButton: !progress?.token_purchased,
        currentPurchasedState: purchased, // Логируем текущее состояние
      });
      
      // Проверяем, куплен ли уже токен в базе данных (только БД, не баланс)
      // Баланс может быть от других источников, поэтому проверяем только флаг в БД
      if (progress?.token_purchased === true) {
        // Если токен куплен в БД, считаем его купленным
        console.log('✅ [BUYTOKEN] Token purchased in DB, setting purchased=true');
        setPurchased(true);
        // После покупки токена всегда можно опубликовать ссылку (если еще не опубликована)
        const linkPublished = sessionStorage.getItem('link_published') === 'true' || 
                             localStorage.getItem('link_published') === 'true';
        if (!linkPublished) {
          setCanPublishLink(true);
        }
      } else {
        // Если токен не куплен в БД, показываем кнопку покупки
        console.log('🛒 [BUYTOKEN] Token NOT purchased in DB, setting purchased=false, showing buy button');
        setPurchased(false);
        setCanPublishLink(false);
      }
    } catch (error) {
      console.error('❌ [BUYTOKEN] Error in checkProgress:', error);
      // При ошибке показываем кнопку покупки (безопасный вариант)
      setPurchased(false);
      setCanPublishLink(false);
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
      setError('Please authorize through Farcaster');
      return;
    }

    // Проверяем подключение кошелька
    if (!walletAddress || !isConnected) {
      setError('Please connect wallet to purchase token');
      return;
    }

    // Проверяем баланс USDC
    if (useUSDC && usdcBalance) {
      const usdcAmount = parseUnits(PURCHASE_AMOUNT_USDC.toString(), 6); // USDC имеет 6 decimals
      if (usdcBalance.value < usdcAmount) {
        setError(`Insufficient USDC. Required: ${PURCHASE_AMOUNT_USDC.toFixed(2)} USDC`);
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
    
    let errorMessage = err?.message || err?.reason || 'Unexpected error purchasing token';
    let errorType: 'user_rejection' | 'network' | 'insufficient_balance' | 'insufficient_funds' | 'slippage' | 'timeout' | 'unknown' | 'retryable' = 'unknown';
    let helpfulMessage = '';
    
    // Определяем тип ошибки с конкретными подсказками
    const errorLower = errorMessage.toLowerCase();
    
    if (errorLower.includes('user rejected') || 
        errorLower.includes('cancel') ||
        errorLower.includes('denied') ||
        errorLower.includes('rejected')) {
      errorType = 'user_rejection';
      errorMessage = 'Transaction cancelled by user';
      helpfulMessage = '';
    } else if (errorLower.includes('insufficient funds') || 
               errorLower.includes('insufficient balance') ||
               (errorLower.includes('insufficient') && errorLower.includes('usdc'))) {
      errorType = 'insufficient_funds';
      errorMessage = `Insufficient USDC for purchase`;
      helpfulMessage = `💡 Add more USDC to wallet. Minimum ${PURCHASE_AMOUNT_USDC.toFixed(2)} USDC + ETH for gas required`;
    } else if (errorLower.includes('insufficient') || 
               errorLower.includes('balance') ||
               (errorLower.includes('amount') && !errorLower.includes('slippage'))) {
      errorType = 'insufficient_balance';
      errorMessage = 'Insufficient funds to execute swap';
      helpfulMessage = `💡 Check USDC balance in wallet. Available: ${usdcBalance ? formatUnits(usdcBalance.value, usdcBalance.decimals) : '0'} USDC`;
    } else if (errorLower.includes('slippage') || 
               errorLower.includes('price impact') ||
               errorLower.includes('execution reverted: dsr') ||
               errorLower.includes('execution reverted: spc')) {
      errorType = 'slippage';
      errorMessage = 'Slippage tolerance exceeded';
      helpfulMessage = '💡 Increase slippage tolerance in swap settings or try later when liquidity improves';
    } else if (errorLower.includes('timeout') || 
               errorLower.includes('network') || 
               errorLower.includes('connection') ||
               errorLower.includes('fetch') ||
               isTimeout) {
      errorType = 'timeout';
      errorMessage = isTimeout 
        ? `Timeout: swap did not complete in ${SWAP_TIMEOUT_MS / 1000} seconds` 
        : 'Network error';
      helpfulMessage = '💡 Check internet connection and try again';
    } else if (errorLower.includes('gas') || 
               errorLower.includes('fee') ||
               (errorLower.includes('execution') && !errorLower.includes('slippage')) ||
               (errorLower.includes('revert') && !errorLower.includes('slippage'))) {
      errorType = 'retryable';
      if (retryCount < MAX_RETRIES) {
        errorMessage = `Execution error: ${errorMessage}`;
        helpfulMessage = '💡 Try again - this may be a temporary network issue';
      } else {
        errorMessage = `Execution error after ${MAX_RETRIES} attempts: ${errorMessage}`;
        helpfulMessage = '💡 Refresh the page and try again';
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
        setError(`${finalMessage}\n\n(Attempt ${retryCount + 1}/${MAX_RETRIES})`);
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
      setError('Maximum number of attempts exceeded. Please refresh the page and try again.');
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
        const mctReceived = newBalance - oldBalanceBeforeSwap;
        console.log('✅ Balance increased! Swap completed successfully');
        console.log(`📊 Balance: ${oldBalanceBeforeSwap} → ${newBalance} MCT (received: ${mctReceived.toFixed(4)} MCT)`);
        setIsSwapping(false);
        setSwapInitiatedAt(null);
        setOldBalanceBeforeSwap(null);
        setLastCheckedBlock(null);
        setBlocksSinceSwap(0);
        setPurchased(true);
        
        // Отметить покупку в базе данных и отправить уведомление
        if (user) {
          // Передаем txHash если доступен (для dexscreener и истории транзакций)
          markTokenPurchased(user.fid, txHash || undefined).then(() => {
            console.log('✅ [DB] Token purchase marked in database' + (txHash ? ` with txHash: ${txHash}` : ''));
            
            // После покупки токена всегда можно опубликовать ссылку (если еще не опубликована)
                  const linkPublished = typeof window !== 'undefined' && (
                    sessionStorage.getItem('link_published') === 'true' || 
                    localStorage.getItem('link_published') === 'true'
                  );
                  if (!linkPublished) {
                    setCanPublishLink(true);
              // Автоматически редиректим на /submit через 2 секунды
              // Используем router.replace для навигации внутри Farcaster Mini App iframe
              // router.replace не создает новую запись в истории и не открывает новую вкладку
              console.log('✅ [BUYTOKEN] Token purchased, redirecting to /submit in 2 seconds...');
              setTimeout(() => {
                // Используем router.replace для навигации внутри iframe
                // Это гарантирует, что мы остаемся в Farcaster Mini App
                router.replace('/submit');
              }, 2000);
                  }
            
            // Уведомление отключено, чтобы не открывать внешние ссылки и не выводить из Farcaster Mini App
            // sdk.actions.openUrl с внешним URL (BaseScan) выводит пользователя из iframe
            console.log('ℹ️ [NOTIFICATION] Purchase notification skipped to keep user in Farcaster Mini App');
            
            // Публикация cast отключена, чтобы не открывать новую вкладку после покупки
            // Пользователь остается в Farcaster Mini App
            console.log('ℹ️ [CAST] Cast publication skipped to keep user in Farcaster Mini App');
          }).catch((dbError) => {
            console.error('❌ [DB] Error marking token purchase in DB:', dbError);
          });
        }
        
        // Не переходим на /submit автоматически - остаемся на странице покупки
        // Пользователь может нажать кнопку "ADD YOUR LINK" если все задачи выполнены
        console.log('✅ [BUYTOKEN] Token purchase completed, staying on buy token page');
      }
  }, [mctBalance, isSwapping, oldBalanceBeforeSwap, user, router, txHash]);
  
  // Убрали дублирующую проверку - checkProgress уже вызывается в основном useEffect
  // Это предотвращает конфликты в установке purchased

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
        const errorMsg = `Insufficient USDC. Required: ${PURCHASE_AMOUNT_USDC.toFixed(2)} USDC, available: ${formatUnits(usdcBalance.value, usdcBalance.decimals)}`;
        setError(errorMsg);
        setLastError(errorMsg);
        return;
      }
    }

    setLoading(true);
    setError('');
    setLastError(null);

    try {
      // КРИТИЧНО: sellAmount должен быть в wei формате (6 decimals для USDC)
      // Согласно документации OnchainKit: "Amount to sell, formatted as a numeric string including decimals"
      // Пример: "1 USDC (1_000_000)" -> для 0.10 USDC это "100000"
      const usdcAmountWei = parseUnits(PURCHASE_AMOUNT_USDC.toString(), 6); // 0.10 USDC = 100000
      const usdcAmountStr = usdcAmountWei.toString(); // "100000"

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

      // Таймаут для swap - 60 секунд
      const timeoutId = setTimeout(() => {
        console.warn(`⏱️ Swap timeout: ${SWAP_TIMEOUT_MS / 1000} seconds elapsed without response`);
        handleSwapError(new Error(`Timeout: swap не завершился за ${SWAP_TIMEOUT_MS / 1000} секунд`), true);
      }, SWAP_TIMEOUT_MS);
      setSwapTimeoutId(timeoutId);
      
      // Запускаем таймер ожидания для UI
      setSwapWaitTime(0);

      // Проверяем, что swapTokenAsync готов перед вызовом
      if (!swapTokenAsync) {
        throw new Error('Swap function not ready. Please try again.');
      }

      // ⚠️ КРИТИЧНО: Увеличиваем задержку для первого вызова, чтобы Farcaster SDK успел инициализироваться
      // При первом вызове форма может не предзаполниться суммой, если SDK еще не готов
      const initializationDelay = isFirstSwapCall ? 800 : 100;
      console.log(`⏳ [SWAP] Waiting ${initializationDelay}ms for swap initialization (first call: ${isFirstSwapCall})...`);
      
      // ⚠️ КРИТИЧНО: Для первого вызова пытаемся явно установить параметры через методы hook
      if (isFirstSwapCall && swapHookResult && typeof swapHookResult === 'object') {
        try {
          // Пытаемся установить токены и сумму через методы hook, если они доступны
          if (typeof (swapHookResult as any).setTokenFrom === 'function') {
            console.log('🔧 [SWAP] Setting tokenFrom to USDC via hook method...');
            (swapHookResult as any).setTokenFrom(`eip155:8453/erc20:${USDC_CONTRACT_ADDRESS}`);
            await new Promise(resolve => setTimeout(resolve, 150));
          }
          
          if (typeof (swapHookResult as any).setTokenTo === 'function') {
            console.log('🔧 [SWAP] Setting tokenTo to MCT via hook method...');
            (swapHookResult as any).setTokenTo(`eip155:8453/erc20:${MCT_CONTRACT_ADDRESS}`);
            await new Promise(resolve => setTimeout(resolve, 150));
          }
          
          if (typeof (swapHookResult as any).setFromAmount === 'function') {
            console.log(`🔧 [SWAP] Setting fromAmount to ${PURCHASE_AMOUNT_USDC.toFixed(2)} via hook method...`);
            (swapHookResult as any).setFromAmount(PURCHASE_AMOUNT_USDC.toFixed(2));
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        } catch (hookError) {
          console.warn('⚠️ [SWAP] Could not set parameters via hook methods, will use swapParams only:', hookError);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, initializationDelay));
      
      // После первого вызова помечаем, что это уже не первый раз
      if (isFirstSwapCall) {
        setIsFirstSwapCall(false);
      }

      let result;
      try {
        // Проверяем, что FID доступен для логирования
        console.log(`🔍 [SWAP] User FID: ${user.fid}, Wallet context should be set by onchainkit`);
        // Логирование будет после создания swapParams

        // КРИТИЧНО: Согласно тестам OnchainKit, sellAmount должен быть в wei формате
        // Тест показывает: sellAmount: '1000000' для 1 USDC (6 decimals)
        // Для 0.10 USDC: 0.10 * 10^6 = 100000
        // В типах Farcaster: "Sell token amount, as numeric string. For example, 1 USDC: 1000000"
        const swapParams: {
          sellToken: string;
          buyToken: string;
          sellAmount: string;
        } = {
          sellToken: `eip155:8453/erc20:${USDC_CONTRACT_ADDRESS}`, // USDC на Base
          buyToken: `eip155:8453/erc20:${MCT_CONTRACT_ADDRESS}`, // MCT Token на Base
          sellAmount: usdcAmountStr, // "100000" - wei формат (0.10 USDC с 6 decimals)
        };
        
        console.log('🔍 [SWAP] Final params (wei format according to tests):', {
          ...swapParams,
          sellAmountWei: usdcAmountStr,
          sellAmountFormatted: `${PURCHASE_AMOUNT_USDC.toFixed(2)} USDC`,
          calculation: `0.10 USDC * 10^6 = ${usdcAmountStr}`,
          note: 'According to OnchainKit tests, sellAmount must be in wei format (numeric string)',
        });

        console.log(`🚀 [SWAP] Calling swapTokenAsync NOW with exact params:`, {
          ...swapParams,
          paramsStringified: JSON.stringify(swapParams),
          timestamp: new Date().toISOString(),
        });
        
        // КРИТИЧНО: Логируем что именно передается в Farcaster SDK
        console.log('📤 [SWAP] Parameters being sent to sdk.actions.swapToken:', {
          sellToken: swapParams.sellToken,
          buyToken: swapParams.buyToken,
          sellAmount: swapParams.sellAmount,
          sellAmountType: typeof swapParams.sellAmount,
          sellAmountLength: swapParams.sellAmount.length,
          isNumeric: !isNaN(Number(swapParams.sellAmount)),
          expectedFormat: 'wei format: "100000" for 0.10 USDC (6 decimals)',
        });
        
        result = await swapTokenAsync(swapParams);
        
        console.log('📥 [SWAP] swapTokenAsync returned:', {
          result,
          resultType: typeof result,
          resultKeys: result ? Object.keys(result) : [],
          resultStringified: JSON.stringify(result),
          note: 'If result is undefined/null, form opened but amount may not be pre-filled',
        });
        
        // Очищаем таймаут при успешном запуске
        if (timeoutId) {
          clearTimeout(timeoutId);
          setSwapTimeoutId(null);
        }
      } catch (swapError: any) {
        // Очищаем таймаут при ошибке
        if (timeoutId) {
          clearTimeout(timeoutId);
          setSwapTimeoutId(null);
        }
        
        console.error('❌ [SWAP] Swap error:', {
          message: swapError?.message,
          code: swapError?.code,
          name: swapError?.name,
          stack: swapError?.stack,
        });
        throw swapError;
      }

      // Детальное логирование результата swap
      console.log('📊 [SWAP] Swap result:', {
        success: !!result,
        result: result,
        resultType: typeof result,
        resultKeys: result ? Object.keys(result) : [],
        userFid: user.fid,
        sellAmount: `${PURCHASE_AMOUNT_USDC.toFixed(2)} USDC (${usdcAmountStr} wei)`,
        sellToken: USDC_CONTRACT_ADDRESS,
        buyToken: MCT_CONTRACT_ADDRESS,
      });

      // Пытаемся извлечь txHash из результата (если доступен)
      // swapTokenAsync может вернуть объект с txHash или просто открыть форму в кошельке
      let extractedTxHash: string | undefined = undefined;
      if (result) {
        if (typeof result === 'string') {
          // Если result - это строка, возможно это txHash
          extractedTxHash = result;
        } else if (typeof result === 'object') {
          // Пробуем разные возможные поля
          extractedTxHash = (result as any).txHash || 
                           (result as any).hash || 
                           (result as any).transactionHash ||
                           (result as any).tx?.hash ||
                           (result as any).transaction?.hash;
        }
      }

      if (extractedTxHash) {
        console.log('✅ [SWAP] Transaction hash extracted from result:', extractedTxHash);
        setTxHash(extractedTxHash);
      } else {
        console.log('ℹ️ [SWAP] No txHash in result - swap form opened in wallet, will wait for balance update');
      }

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

  // Таймер для отслеживания времени ожидания swap
  useEffect(() => {
    if (!isSwapping) {
      setSwapWaitTime(0);
      return;
    }

    const interval = setInterval(() => {
      setSwapWaitTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isSwapping]);

  // Функция для сброса состояния swap
  const resetSwapState = () => {
    console.log('🔄 [SWAP] Resetting swap state...');
    if (swapTimeoutId) {
      clearTimeout(swapTimeoutId);
      setSwapTimeoutId(null);
    }
    setIsSwapping(false);
    setSwapInitiatedAt(null);
    setOldBalanceBeforeSwap(null);
    setLastCheckedBlock(null);
    setBlocksSinceSwap(0);
    setSwapWaitTime(0);
    setLoading(false);
    setError('Состояние транзакции сброшено. Попробуйте снова.');
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
      {/* Hero Section с градиентом */}
      <div className="relative min-h-screen overflow-hidden">
        {/* Анимированный градиент фон */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-accent animate-gradient bg-300%"></div>
        
        {/* Геометрические фигуры */}
        <div className="absolute top-20 right-20 w-32 h-32 bg-white bg-opacity-10 rounded-full animate-float"></div>
        <div className="absolute bottom-32 left-20 w-24 h-24 bg-white bg-opacity-15 rounded-full animate-float" style={{animationDelay: '2s'}}></div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
          {/* Заголовок в стиле модного сайта */}
          <div className="text-center mb-16">
            <div className="relative -mt-2 sm:mt-0">
              <h1 className="text-white mb-12 sm:mb-24 leading-none flex items-center justify-center gap-4 sm:gap-8 px-4 sm:px-16">
                <span className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-white">
                  BUY
                </span>
                <span className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-white">
                  TOKEN
                </span>
              </h1>
            </div>

            <div className="flex items-center justify-center gap-3 sm:gap-6 mt-12 sm:mt-24 mb-8 sm:mb-16">
              <div className="w-10 sm:w-20 h-1 bg-white"></div>
              <div className="flex items-center gap-4">
                {/* Увеличенное фото Миссис Крипто */}
                <div className="w-28 h-28 sm:w-40 sm:h-40 rounded-full overflow-hidden border-4 border-white shadow-2xl">
                  <Image
                    src="/images/mrs-crypto.jpg"
                    alt="Mrs. Crypto"
                    width={160}
                    height={160}
                    className="w-full h-full object-cover"
                    priority
                    unoptimized
                  />
                </div>
              </div>
              <div className="w-10 sm:w-20 h-1 bg-white"></div>
            </div>
            <p className="text-xl sm:text-3xl md:text-4xl text-white font-bold mb-4 tracking-wide px-4">
              <span className="text-white">❤️</span> MRS. CRYPTO TOKEN <span className="text-white">❤️</span>
            </p>
            <p className="text-lg text-white text-opacity-90 max-w-2xl mx-auto">
              Buy a token to enable adding your link
            </p>
          </div>

          {/* Модная карточка покупки */}
          <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-3xl shadow-2xl p-6 sm:p-12 mb-12 border border-white border-opacity-20 mt-6 sm:mt-12">
          {/* Информация о кошельке */}
          {walletAddress && (
            <div className="bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 rounded-xl p-6 mb-6 border border-primary/20">
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg text-gray-700 font-semibold">Your wallet:</span>
                <span className="font-mono text-lg font-bold text-primary">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-lg text-gray-700 font-semibold">Token balance:</span>
                <span className="font-bold text-primary text-2xl">
                  {parseFloat(tokenBalance).toFixed(2)} $MCT
                </span>
              </div>
            </div>
          )}

          {!walletAddress && (
            <div className="mb-6">
              <div className="text-center">
                <button
                  onClick={() => connect({ connector: farcasterMiniApp() })}
                  disabled={isConnecting}
                  className={`btn-gold-glow w-full text-base sm:text-xl px-8 sm:px-16 py-4 sm:py-6 font-bold text-white group ${
                    isConnecting ? 'disabled' : ''
                  }`}
                >
                  {/* Переливающийся эффект */}
                  {!isConnecting && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                  )}
                  {/* Внутреннее свечение */}
                  {!isConnecting && (
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
                  )}
                  <span className="relative z-20 drop-shadow-lg">
                  {isConnecting ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>CONNECTING...</span>
                    </div>
                  ) : (
                    '🔗 CONNECT WALLET'
                  )}
                  </span>
                </button>
              </div>
            </div>
          )}


          {/* Ошибка с retry */}
          {error && (
            <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">❌</span>
                <div className="flex-1">
                  <p className="text-red-800 text-xl font-semibold mb-2 whitespace-pre-line">
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
                        🔄 Try Again ({retryCount + 1}/{MAX_RETRIES})
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
                        ✖️ Close
                      </Button>
                    </div>
                  )}
                  {retryCount >= MAX_RETRIES && (
                    <div className="mt-4">
                      <p className="text-red-600 text-sm mb-2">
                        Maximum number of attempts exceeded. Refresh the page and try again.
                      </p>
                      <Button
                        onClick={() => window.location.reload()}
                        variant="secondary"
                      >
                        🔄 Refresh Page
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
                  rel="noopener noreferrer"
                  target="_blank"
                  onClick={(e) => {
                    // Открываем BaseScan в новой вкладке только при явном клике
                    // Это не влияет на автоматический редирект после покупки
                    e.stopPropagation();
                  }}
                  className="font-mono text-sm break-all text-primary hover:text-primary-dark underline"
                >
                  {txHash}
                </a>
                <p className="text-xs text-gray-500 mt-1">
                  View on BaseScan ↗
                </p>
              </div>

              {canPublishLink ? (
              <p className="text-center text-success font-semibold mt-4">
                Redirecting to add your link...
              </p>
              ) : (
                <p className="text-center text-gray-600 font-semibold mt-4">
                  Complete all tasks to add your link
                </p>
              )}
            </div>
          )}

          {/* Информация о сумме покупки */}
          {walletAddress && !purchased && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <p className="text-sm text-blue-800 text-center">
                <span className="font-semibold">💡 Amount:</span> The swap will be pre-filled with <span className="font-bold">{PURCHASE_AMOUNT_USDC.toFixed(2)} USDC</span>. If the field is empty, enter <span className="font-bold">{PURCHASE_AMOUNT_USDC.toFixed(2)} USDC</span> manually.
              </p>
            </div>
          )}

          {/* Кнопка покупки */}
          {(() => {
            console.log('🔍 [BUYTOKEN] Render check - purchased:', purchased, 'walletAddress:', !!walletAddress);
            return !purchased;
          })() ? (
            <button
              onClick={handleBuyToken}
              disabled={loading || isSwapping || !walletAddress}
              className={`btn-gold-glow w-full text-base sm:text-xl px-8 sm:px-16 py-4 sm:py-6 font-bold text-white group ${
                loading || isSwapping || !walletAddress ? 'disabled' : ''
              }`}
            >
              {/* Переливающийся эффект */}
              {!loading && !isSwapping && walletAddress && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              )}
              {/* Внутреннее свечение */}
              {!loading && !isSwapping && walletAddress && (
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
              )}
              <span className="relative z-10 drop-shadow-lg">
                {isSwapping 
                  ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>WAITING FOR SWAP...</span>
                    </div>
                  )
                  : loading 
                    ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>PROCESSING...</span>
                      </div>
                    )
                    : `❤️ BUY MRS. CRYPTO TOKEN${displayUsdPrice ? ` FOR ${displayUsdPrice}` : ' (FREE)'}`
                }
              </span>
            </button>
          ) : (
            <button
              onClick={() => {
                router.replace('/submit');
              }}
              className="btn-gold-glow w-full text-base sm:text-xl px-8 sm:px-16 py-4 sm:py-6 font-bold text-white group"
            >
              {/* Переливающийся эффект */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              {/* Внутреннее свечение */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
              <span className="relative z-20 drop-shadow-lg">ADD YOUR LINK →</span>
            </button>
          )}

          {/* Кнопка "ADD YOUR LINK" после покупки */}
          {false && purchased && (
            <button
              onClick={() => {
                router.replace('/submit');
              }}
              className="btn-gold-glow w-full text-base sm:text-xl px-8 sm:px-16 py-4 sm:py-6 font-bold text-white group"
            >
              {/* Переливающийся эффект */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              {/* Внутреннее свечение */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
              <span className="relative z-20 drop-shadow-lg">ADD YOUR LINK →</span>
            </button>
          )}
          
          {/* Индикатор ожидания завершения swap */}
          {isSwapping && (
            <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-6 mt-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <p className="text-blue-800 text-lg font-semibold">
                    Waiting for transaction completion...
                  </p>
                </div>
                <p className="text-blue-600 text-sm mb-2">
                  Confirm the transaction in your Farcaster wallet. Balance will update automatically.
                </p>
                {swapWaitTime > 0 && (
                  <p className="text-blue-500 text-xs mb-4">
                    Waiting: {swapWaitTime} sec. / 60 sec.
                  </p>
                )}
                {swapWaitTime > 30 && (
                  <div className="mt-4 pt-4 border-t border-blue-300">
                    <p className="text-orange-600 text-sm mb-3">
                      ⚠️ Transaction is taking longer than usual.
                    </p>
                    <Button
                      onClick={resetSwapState}
                      variant="secondary"
                      className="text-sm"
                    >
                      Reset state and try again
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

          {/* Модальное окно подтверждения покупки - убрано для one-tap UX */}

          {/* Модная инструкция */}
          <div className="bg-gradient-to-r from-primary via-secondary to-accent text-white rounded-3xl p-8 shadow-2xl mt-32">
            <h3 className="text-3xl font-black mb-6 flex items-center gap-3 font-display">
              <span className="text-4xl">❤️</span>
              TOKEN PURCHASE INFO
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-white bg-opacity-20 rounded-xl">
                  <span className="text-3xl font-black text-accent">01</span>
                  <span className="font-bold text-xl">Purchase 0.10 MCT through Base network</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white bg-opacity-20 rounded-xl">
                  <span className="text-3xl font-black text-accent">02</span>
                  <span className="font-bold text-xl">Payment method: USDC</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-white bg-opacity-20 rounded-xl">
                  <span className="text-3xl font-black text-accent">03</span>
                  <span className="font-bold text-xl">Network switches to Base automatically</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white bg-opacity-20 rounded-xl">
                  <span className="text-3xl font-black text-accent">04</span>
                  <span className="font-bold text-xl">Token sent to your connected wallet</span>
                </div>
              </div>
              <div className="flex items-center justify-center gap-3 p-3 bg-gradient-to-r from-accent to-secondary rounded-xl col-span-1 md:col-span-2 text-center">
                <span className="text-3xl">🚀</span>
                <span className="font-bold text-xl">After purchase you can add your link!</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

