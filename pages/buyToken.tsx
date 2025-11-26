// Страница покупки токена Миссис Крипто
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Layout from '@/components/Layout';
import Button from '@/components/Button';
import { useAccount, useBalance, useConnect, useBlockNumber } from 'wagmi';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';
import { useSwapToken } from '@coinbase/onchainkit/minikit';
import { getTokenInfo, getMCTAmountForPurchase } from '@/lib/web3';
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
        error: 'SDK available only on client',
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

// Using onchain quotes through Uniswap for USDC swaps

export default function BuyToken() {
  const router = useRouter();
  const { address: walletAddress, isConnected, chainId } = useAccount();
  const { connect, isPending: isConnecting } = useConnect();
  
  // КРИТИЧНО: Синхронизация isConnected с localStorage для сохранения сессии
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Сохраняем состояние подключения
    if (isConnected && walletAddress) {
      localStorage.setItem('wallet_connected', 'true');
      localStorage.setItem('wallet_address', walletAddress);
      console.log('✅ [WALLET] Connection state saved to localStorage');
    } else {
      localStorage.removeItem('wallet_connected');
      localStorage.removeItem('wallet_address');
    }
  }, [isConnected, walletAddress]);
  
  // Восстанавливаем состояние подключения из localStorage при монтировании
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const wasConnected = localStorage.getItem('wallet_connected') === 'true';
    const savedAddress = localStorage.getItem('wallet_address');
    
    if (wasConnected && savedAddress && !isConnected) {
      console.log('🔄 [WALLET] Restoring connection from localStorage...');
      // Попытка переподключения будет выполнена автоматически через wagmi
    }
  }, []);
  
  // КРИТИЧНО: Проверяем chainId - должен быть строго 8453 (Base)
  useEffect(() => {
    if (chainId && chainId !== 8453) {
      console.warn(`⚠️ [CHAIN] Wrong chain ID: ${chainId}, expected 8453 (Base)`);
      setError(`Please switch to Base network (chain ID: 8453). Current: ${chainId}`);
    } else if (chainId === 8453) {
      console.log('✅ [CHAIN] Correct chain ID: 8453 (Base)');
    }
  }, [chainId]);
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapInitiatedAt, setSwapInitiatedAt] = useState<number | null>(null);
  const [oldBalanceBeforeSwap, setOldBalanceBeforeSwap] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [swapTimeoutId, setSwapTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [lastCheckedBlock, setLastCheckedBlock] = useState<bigint | null>(null);
  const [blocksSinceSwap, setBlocksSinceSwap] = useState(0);
  const [swapWaitTime, setSwapWaitTime] = useState(0);
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
  // useSwapToken hook - проверяем правильную структуру возвращаемого значения
  const swapHookResult = useSwapToken();
  
  // КРИТИЧНО: Обработка ошибок disconnect и retry connect через отдельный useEffect
  useEffect(() => {
    // Отслеживаем изменения isConnected для обнаружения disconnect
    if (typeof window === 'undefined') return;
    
    const wasConnected = localStorage.getItem('wallet_connected') === 'true';
    
    // Если было подключение, но сейчас отключено - это disconnect
    if (wasConnected && !isConnected && !isConnecting) {
      console.log('🔄 [WALLET] Disconnect detected, attempting to reconnect...');
      
      // Очищаем localStorage
      localStorage.removeItem('wallet_connected');
      localStorage.removeItem('wallet_address');
      
      // Пытаемся переподключиться через 1 секунду
      setTimeout(async () => {
        if (!isConnected && !isConnecting) {
          console.log('🔄 [WALLET] Retrying wallet connection...');
          
          // КРИТИЧНО: Убеждаемся, что SDK инициализирован перед переподключением
          try {
            const isInFarcasterFrame = window.self !== window.top;
            if (isInFarcasterFrame) {
              const { sdk } = await import('@farcaster/miniapp-sdk');
              if (sdk && sdk.actions && typeof sdk.actions.ready === 'function') {
                await sdk.actions.ready();
                console.log('✅ [WALLET] SDK ready() called before reconnection');
              }
            }
          } catch (sdkError: any) {
            console.warn('⚠️ [WALLET] SDK ready() not available during reconnection:', sdkError?.message);
          }
          
          // Небольшая задержка для инициализации
          await new Promise(resolve => setTimeout(resolve, 300));
          
          try {
            connect({ connector: farcasterMiniApp() });
          } catch (connectError: any) {
            console.error('❌ [WALLET] Reconnection failed:', connectError);
          }
        }
      }, 1000);
    }
  }, [isConnected, isConnecting, connect]);
  
  // КРИТИЧНО: Проверяем инициализацию OnchainKit и Farcaster SDK при монтировании
  useEffect(() => {
    const checkInitialization = async () => {
      if (typeof window === 'undefined') return;
      
      const isInFarcasterFrame = window.self !== window.top;
      if (!isInFarcasterFrame) {
        console.log('ℹ️ [INIT] Not in Farcaster frame, skipping initialization check');
        return;
      }
      
      try {
        // Проверяем Farcaster SDK
        const { sdk } = await import('@farcaster/miniapp-sdk');
        console.log('✅ [INIT] Farcaster SDK loaded:', {
          hasSDK: !!sdk,
          hasActions: !!sdk?.actions,
          hasReady: typeof sdk?.actions?.ready === 'function',
        });
        
        // Проверяем OnchainKit (через window)
        const hasOnchainKit = typeof window !== 'undefined' && (window as any).onchainkit;
        console.log('✅ [INIT] OnchainKit check:', {
          hasOnchainKit,
        });
        
        // Проверяем wagmi connector
        const hasWagmi = typeof window !== 'undefined' && (window as any).wagmi;
        console.log('✅ [INIT] Wagmi check:', {
          hasWagmi,
        });
        
      } catch (error: any) {
        console.error('❌ [INIT] Error checking initialization:', error);
      }
    };
    
    checkInitialization();
  }, []);
  
  // КРИТИЧНО: useSwapToken может возвращать либо объект с swapTokenAsync, либо саму функцию
  let swapTokenAsync: any = null;
  if (typeof swapHookResult === 'function') {
    // Если хук возвращает функцию напрямую
    swapTokenAsync = swapHookResult;
  } else if (swapHookResult && typeof (swapHookResult as any).swapTokenAsync === 'function') {
    // Если хук возвращает объект с методом swapTokenAsync
    swapTokenAsync = (swapHookResult as any).swapTokenAsync;
  } else {
    // Fallback: пробуем использовать весь объект как функцию
    swapTokenAsync = swapHookResult as any;
  }
  
  // Логируем структуру для диагностики
  useEffect(() => {
    if (swapHookResult) {
      console.log('🔍 [SWAP-HOOK] useSwapToken returned:', {
        type: typeof swapHookResult,
        isFunction: typeof swapHookResult === 'function',
        keys: typeof swapHookResult === 'object' ? Object.keys(swapHookResult) : [],
        hasSwapTokenAsync: typeof (swapHookResult as any)?.swapTokenAsync === 'function',
        swapTokenAsyncType: typeof swapTokenAsync,
        swapTokenAsyncIsFunction: typeof swapTokenAsync === 'function',
      });
    }
  }, [swapHookResult, swapTokenAsync]);
  
  // Состояние для manual amount - устанавливаем 0.10 USDC
  // КРИТИЧНО: Явно устанавливаем "0.10" для синхронизации с useSwapToken
  const [manualAmount, setManualAmount] = useState<string>('0.10');

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
  const [tokenPriceUsd, setTokenPriceUsd] = useState<string | null>(null);
  const [mctAmountForPurchase, setMctAmountForPurchase] = useState<bigint | null>(null);

  // Конфигурация (используем только USDC для покупки)
  const useUSDC = true; // Только USDC
  const currencySymbol = 'USDC';
  
  const tokenBalance = mctBalance ? formatUnits(mctBalance.value, mctBalance.decimals) : '0';
  
  const parsedUsdcPrice = tokenPriceUsd ? parseFloat(tokenPriceUsd) : null;
  const isFree = parsedUsdcPrice === 0 || parsedUsdcPrice === null;
  const displayUsdPrice = tokenPriceUsd && parseFloat(tokenPriceUsd) > 0 ? `$${tokenPriceUsd}` : null;
  const purchasePriceLabel = isFree ? 'Free' : (displayUsdPrice || 'the configured price');

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

  // КРИТИЧНО: Устанавливаем параметры swap сразу при подключении кошелька
  // Это должно происходить ДО вызова swapTokenAsync, чтобы форма открылась с правильной суммой
  useEffect(() => {
    if (isConnected && walletAddress && swapHookResult) {
      console.log('🔧 [SWAP-SETUP] Setting up swap parameters when wallet connected:', {
        manualAmount,
        walletAddress,
        isConnected,
        chainId: 8453, // Base
        sellToken: `eip155:8453/erc20:${USDC_CONTRACT_ADDRESS}`,
        buyToken: `eip155:8453/erc20:${MCT_CONTRACT_ADDRESS}`,
        swapHookKeys: typeof swapHookResult === 'object' ? Object.keys(swapHookResult || {}) : [],
      });
      
      // КРИТИЧНО: Порядок установки важен! Сначала from token, потом to token, потом amount
      const setupSwapParams = async () => {
        // ШАГ 1: Устанавливаем from token (USDC) ПЕРВЫМ
        const usdcTokenId = `eip155:8453/erc20:${USDC_CONTRACT_ADDRESS}`;
        if (typeof (swapHookResult as any)?.setTokenFrom === 'function') {
          (swapHookResult as any).setTokenFrom(usdcTokenId);
          console.log('✅ [SWAP-SETUP] STEP 1: setTokenFrom(USDC)');
        } else if ((swapHookResult as any).tokenFrom !== undefined) {
          (swapHookResult as any).tokenFrom = usdcTokenId;
          console.log('✅ [SWAP-SETUP] STEP 1: tokenFrom = USDC');
        }
        
        // Небольшая задержка между установками
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // ШАГ 2: Устанавливаем to token (MCT)
        const mctTokenId = `eip155:8453/erc20:${MCT_CONTRACT_ADDRESS}`;
        if (typeof (swapHookResult as any)?.setTokenTo === 'function') {
          (swapHookResult as any).setTokenTo(mctTokenId);
          console.log('✅ [SWAP-SETUP] STEP 2: setTokenTo(MCT)');
        } else if ((swapHookResult as any).tokenTo !== undefined) {
          (swapHookResult as any).tokenTo = mctTokenId;
          console.log('✅ [SWAP-SETUP] STEP 2: tokenTo = MCT');
        }
        
        // Небольшая задержка между установками
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // ШАГ 3: Теперь устанавливаем amount (0.10) ПОСЛЕ токенов - КРИТИЧНО!
        if (typeof (swapHookResult as any)?.setFromAmount === 'function') {
          (swapHookResult as any).setFromAmount(manualAmount);
          console.log('✅ [SWAP-SETUP] STEP 3: setFromAmount("0.10")');
        } else if ((swapHookResult as any).fromAmount !== undefined) {
          (swapHookResult as any).fromAmount = manualAmount;
          console.log('✅ [SWAP-SETUP] STEP 3: fromAmount = "0.10"');
        } else if (typeof (swapHookResult as any)?.setAmount === 'function') {
          (swapHookResult as any).setAmount(manualAmount);
          console.log('✅ [SWAP-SETUP] STEP 3: setAmount("0.10")');
        }
        
        // Небольшая задержка перед обновлением quote
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // ШАГ 4: Обновляем quote после установки всех параметров
        if (typeof (swapHookResult as any)?.refreshQuote === 'function') {
          (swapHookResult as any).refreshQuote();
          console.log('✅ [SWAP-SETUP] STEP 4: refreshQuote() called');
        }
        
        // Проверяем, что параметры установлены
        console.log('🔍 [SWAP-SETUP] Parameters after setup:', {
          tokenFrom: (swapHookResult as any)?.tokenFrom,
          tokenTo: (swapHookResult as any)?.tokenTo,
          fromAmount: (swapHookResult as any)?.fromAmount,
          amount: (swapHookResult as any)?.amount,
        });
      };
      
      setupSwapParams();
    }
  }, [isConnected, walletAddress, manualAmount, swapHookResult]);

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

      // Устанавливаем цену для USDC (1 USDC = 1 USD)
      // Для покупки на 0.10 USDC цена фиксированная
      setTokenPriceUsd('0.10');

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
    console.log('🛒 [BUYTOKEN] handleBuyToken called:', {
      user: !!user,
      walletAddress: !!walletAddress,
      isConnected,
      loading,
      isSwapping,
      swapTokenAsync: !!swapTokenAsync,
      swapHookResult: !!swapHookResult,
      manualAmount,
    });
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
        setError(`Insufficient USDC. Required: ${PURCHASE_AMOUNT_USDC} USDC`);
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
      helpfulMessage = `💡 Add more USDC to wallet. Minimum ${PURCHASE_AMOUNT_USDC} USDC required`;
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
      setError('User not authorized');
      setLastError('User not authorized');
      return;
    }

    if (!walletAddress) {
      setError('Wallet not connected');
      setLastError('Wallet not connected');
      return;
    }

    // Проверяем баланс USDC перед каждой попыткой
    if (useUSDC && usdcBalance) {
      const usdcAmount = parseUnits(PURCHASE_AMOUNT_USDC.toString(), 6);
      if (usdcBalance.value < usdcAmount) {
        const errorMsg = `Insufficient USDC. Required: ${PURCHASE_AMOUNT_USDC} USDC, available: ${formatUnits(usdcBalance.value, usdcBalance.decimals)}`;
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

      // Таймаут для swap - 60 секунд
      const timeoutId = setTimeout(() => {
        console.warn(`⏱️ Swap timeout: ${SWAP_TIMEOUT_MS / 1000} seconds elapsed without response`);
        handleSwapError(new Error(`Timeout: swap did not complete within ${SWAP_TIMEOUT_MS / 1000} seconds`), true);
      }, SWAP_TIMEOUT_MS);
      setSwapTimeoutId(timeoutId);
      
      // Запускаем таймер ожидания для UI
      setSwapWaitTime(0);

      // Проверяем, что swapTokenAsync готов перед вызовом
      console.log('🔍 [SWAP] Checking swapTokenAsync before call:', {
        swapTokenAsyncExists: !!swapTokenAsync,
        swapTokenAsyncType: typeof swapTokenAsync,
        swapTokenAsyncValue: swapTokenAsync,
        isFunction: typeof swapTokenAsync === 'function',
        swapHookResultType: typeof swapHookResult,
        swapHookResultKeys: typeof swapHookResult === 'object' ? Object.keys(swapHookResult || {}) : [],
      });
      
      if (!swapTokenAsync || typeof swapTokenAsync !== 'function') {
        console.error('❌ [SWAP] swapTokenAsync is not ready:', {
          swapTokenAsync,
          type: typeof swapTokenAsync,
          swapHookResult,
        });
        throw new Error('Swap function not ready. Please try again.');
      }

      // Проверяем, что все параметры правильно сформированы
      if (!usdcAmountStr || usdcAmountStr === '0' || usdcAmountStr === '') {
        throw new Error('Invalid swap amount. Please try again.');
      }

      // Задержка для инициализации swap функции (особенно при первом вызове)
      // Увеличиваем задержку для первого вызова, чтобы OnchainKit и Farcaster SDK успели инициализироваться
      const isFirstCall = retryCount === 0;
      const delay = isFirstCall ? 800 : 200; // 800ms для первого вызова (дает wallet больше времени на auth и chain state), 200ms для повторов
      console.log(`⏳ [SWAP] Waiting ${delay}ms for wallet context initialization (first call: ${isFirstCall})...`);
      await new Promise(resolve => setTimeout(resolve, delay));

      // КРИТИЧНО: Проверяем wallet address перед вызовом swap
      // Если wallet не готов, это может быть причиной проблемы с суммой
      console.log('🔍 [SWAP] Wallet state before swap:', {
        walletAddress,
        isConnected,
        userFid: user?.fid,
        swapTokenAsyncReady: !!swapTokenAsync,
        swapTokenAsyncType: typeof swapTokenAsync,
      });

      if (!walletAddress) {
        throw new Error('Wallet address not ready. Please wait for wallet connection.');
      }

      let result;
      // Объявляем swapCallParams вне try блока для использования в catch
      let savedSwapCallParams: any = null;
      
      try {
        // Проверяем, что FID доступен для логирования
        console.log(`🔍 [SWAP] User FID: ${user.fid}, Wallet context should be set by onchainkit`);
        console.log(`🔍 [SWAP] Wallet address confirmed: ${walletAddress}`);
        console.log(`🔍 [SWAP] Swap params:`, {
          sellToken: `eip155:8453/erc20:${USDC_CONTRACT_ADDRESS}`,
          buyToken: `eip155:8453/erc20:${MCT_CONTRACT_ADDRESS}`,
          sellAmount: usdcAmountStr,
          sellAmountFormatted: `${PURCHASE_AMOUNT_USDC} USDC (${usdcAmountStr} wei)`,
          slippageTolerance: 1, // 1% для MCT/USDC пары
        });

        // Убеждаемся, что все параметры готовы перед вызовом
        // Формируем параметры с явной проверкой типов
        // КРИТИЧНО: useSwapToken может ожидать sellAmount в разных форматах
        // Проверяем оба варианта: строку в wei и форматированную строку
        const swapParams: {
          sellToken: string;
          buyToken: string;
          sellAmount: string;
          sellAmountFormatted?: string;
        } = {
          sellToken: `eip155:8453/erc20:${USDC_CONTRACT_ADDRESS}`, // USDC на Base
          buyToken: `eip155:8453/erc20:${MCT_CONTRACT_ADDRESS}`, // MCT Token на Base
          sellAmount: usdcAmountStr, // 0.10 USDC = 100000 wei (parseUnits(0.10, 6))
          // Также передаем форматированную сумму на случай, если useSwapToken ожидает её
          sellAmountFormatted: PURCHASE_AMOUNT_USDC.toString(), // "0.10"
        };

        // Дополнительная проверка перед вызовом
        console.log(`🔍 [SWAP] Final params check before call:`, {
          sellToken: swapParams.sellToken,
          buyToken: swapParams.buyToken,
          sellAmount: swapParams.sellAmount,
          sellAmountFormatted: swapParams.sellAmountFormatted,
          sellAmountType: typeof swapParams.sellAmount,
          sellAmountLength: swapParams.sellAmount?.length,
          usdcDecimals: 6,
          mctDecimals: 18,
          chainId: 8453,
          usdcAddress: USDC_CONTRACT_ADDRESS,
          mctAddress: MCT_CONTRACT_ADDRESS,
          parsedAmount: parseUnits(PURCHASE_AMOUNT_USDC.toString(), 6).toString(),
          formattedAmount: formatUnits(parseUnits(PURCHASE_AMOUNT_USDC.toString(), 6), 6),
        });

        // Убеждаемся, что sellAmount не пустой и не равен нулю
        if (!swapParams.sellAmount || swapParams.sellAmount === '0') {
          throw new Error(`Invalid sellAmount: ${swapParams.sellAmount}. Expected non-zero string.`);
        }

        // КРИТИЧНО: Проверяем wallet address прямо перед вызовом swapTokenAsync
        // Если wallet не готов, делаем retry через 500ms
        if (!walletAddress || !walletAddress) {
          console.log('⚠️ [SWAP] Wallet not ready yet, retrying in 500ms...', {
            walletAddress,
            isConnected,
            retryCount,
          });
          // Сбрасываем состояние swap перед retry
          setIsSwapping(false);
          setSwapInitiatedAt(null);
          setOldBalanceBeforeSwap(null);
          setBlocksSinceSwap(0);
          setSwapWaitTime(0);
          // Retry через 500ms
          setTimeout(() => {
            confirmBuyToken(true); // Передаем isRetry=true для правильного подсчета
          }, 500);
          return; // Выходим из функции, не вызывая swapTokenAsync
        }

        console.log(`🔍 [SWAP] Calling swapTokenAsync with params:`, {
          ...swapParams,
          // Логируем все возможные форматы для диагностики
          sellAmountWei: swapParams.sellAmount,
          sellAmountFormatted: swapParams.sellAmountFormatted,
          expectedFormat: 'String in wei (100000 for 0.10 USDC with 6 decimals)',
        });
        
        // КРИТИЧНО: Тестируем выставление суммы 0.10 USDC
        // Используем manualAmount, который установлен в useState
        const formattedAmount = manualAmount || PURCHASE_AMOUNT_USDC.toString(); // "0.10"
        const weiAmount = usdcAmountStr; // "100000" для 0.10 USDC с 6 decimals
        
        // КРИТИЧНО: Принудительно устанавливаем параметры swap ПЕРЕД вызовом swapTokenAsync
        // Делаем это с задержками между шагами для надежности
        if (swapHookResult) {
          console.log('🔧 [SWAP] Force-setting swap parameters before calling swapTokenAsync...');
          
          // ШАГ 1: Устанавливаем from token (USDC)
          const usdcTokenId = `eip155:8453/erc20:${USDC_CONTRACT_ADDRESS}`;
          if (typeof (swapHookResult as any)?.setTokenFrom === 'function') {
            (swapHookResult as any).setTokenFrom(usdcTokenId);
            console.log('✅ [SWAP] STEP 1: setTokenFrom(USDC)');
          } else if ((swapHookResult as any).tokenFrom !== undefined) {
            (swapHookResult as any).tokenFrom = usdcTokenId;
            console.log('✅ [SWAP] STEP 1: tokenFrom = USDC');
          }
          
          await new Promise(resolve => setTimeout(resolve, 150));
          
          // ШАГ 2: Устанавливаем to token (MCT)
          const mctTokenId = `eip155:8453/erc20:${MCT_CONTRACT_ADDRESS}`;
          if (typeof (swapHookResult as any)?.setTokenTo === 'function') {
            (swapHookResult as any).setTokenTo(mctTokenId);
            console.log('✅ [SWAP] STEP 2: setTokenTo(MCT)');
          } else if ((swapHookResult as any).tokenTo !== undefined) {
            (swapHookResult as any).tokenTo = mctTokenId;
            console.log('✅ [SWAP] STEP 2: tokenTo = MCT');
          }
          
          await new Promise(resolve => setTimeout(resolve, 150));
          
          // ШАГ 3: Устанавливаем amount (0.10) - КРИТИЧНО! Пробуем все возможные методы
          let amountSet = false;
          if (typeof (swapHookResult as any)?.setFromAmount === 'function') {
            (swapHookResult as any).setFromAmount(formattedAmount);
            console.log('✅ [SWAP] STEP 3: setFromAmount("0.10")');
            amountSet = true;
          }
          if (!amountSet && (swapHookResult as any).fromAmount !== undefined) {
            (swapHookResult as any).fromAmount = formattedAmount;
            console.log('✅ [SWAP] STEP 3: fromAmount = "0.10"');
            amountSet = true;
          }
          if (!amountSet && typeof (swapHookResult as any)?.setAmount === 'function') {
            (swapHookResult as any).setAmount(formattedAmount);
            console.log('✅ [SWAP] STEP 3: setAmount("0.10")');
            amountSet = true;
          }
          if (!amountSet && (swapHookResult as any).amount !== undefined) {
            (swapHookResult as any).amount = formattedAmount;
            console.log('✅ [SWAP] STEP 3: amount = "0.10"');
            amountSet = true;
          }
          
          if (!amountSet) {
            console.warn('⚠️ [SWAP] Could not set amount through any method!');
          }
          
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // ШАГ 4: Обновляем quote
          if (typeof (swapHookResult as any)?.refreshQuote === 'function') {
            (swapHookResult as any).refreshQuote();
            console.log('✅ [SWAP] STEP 4: refreshQuote()');
          }
          
          // КРИТИЧНО: Увеличиваем задержку для применения параметров
          console.log('⏳ [SWAP] Waiting 800ms for parameters to apply...');
          await new Promise(resolve => setTimeout(resolve, 800));
          
          // Проверяем, что параметры установлены
          const finalTokenFrom = (swapHookResult as any)?.tokenFrom;
          const finalTokenTo = (swapHookResult as any)?.tokenTo;
          const finalFromAmount = (swapHookResult as any)?.fromAmount || (swapHookResult as any)?.amount;
          
          console.log('🔍 [SWAP] Final parameters verification:', {
            tokenFrom: finalTokenFrom,
            tokenTo: finalTokenTo,
            fromAmount: finalFromAmount,
            isAmountSet: finalFromAmount && finalFromAmount !== '0' && finalFromAmount !== '0.0',
          });
          
          // КРИТИЧНО: Если amount все еще не установлен, устанавливаем еще раз
          if (!finalFromAmount || finalFromAmount === '0' || finalFromAmount === '0.0') {
            console.warn('⚠️ [SWAP] Amount still not set after setup, forcing one more time...');
            if (typeof (swapHookResult as any)?.setFromAmount === 'function') {
              (swapHookResult as any).setFromAmount(formattedAmount);
            } else if ((swapHookResult as any).fromAmount !== undefined) {
              (swapHookResult as any).fromAmount = formattedAmount;
            }
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
        
        // ВАЖНО: Проверяем значения перед использованием
        console.log(`🧪 [TEST] Testing amount formats:`, {
          PURCHASE_AMOUNT_USDC,
          formattedAmount,
          weiAmount,
          formattedAmountType: typeof formattedAmount,
          weiAmountType: typeof weiAmount,
          formattedAmountLength: formattedAmount?.length,
          weiAmountLength: weiAmount?.length,
          isFormattedValid: formattedAmount && formattedAmount !== '0' && formattedAmount !== '0.0',
          isWeiValid: weiAmount && weiAmount !== '0',
        });
        
        // ВАЖНО: Проверяем, что сумма не равна нулю перед вызовом
        if (!formattedAmount || formattedAmount === '0' || formattedAmount === '0.0' || formattedAmount === '0.00') {
          throw new Error(`Invalid formatted amount: ${formattedAmount}. Expected non-zero value like "0.10"`);
        }
        
        if (!weiAmount || weiAmount === '0') {
          throw new Error(`Invalid wei amount: ${weiAmount}. Expected non-zero value like "100000"`);
        }
        
        // КРИТИЧНО: Используем форматированную строку "0.10" для UI
        // OnchainKit ожидает человекочитаемый формат, не wei
        // ВАЖНО: Передаем параметры напрямую в swapTokenAsync, даже если они уже установлены через методы
        
        // КРИТИЧНО: Формируем полный набор параметров для Farcaster wallet
        // Farcaster wallet может требовать recipient, deadline, и правильный формат
        const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 минут от сейчас
        
        let swapCallParams: any = {
          sellToken: swapParams.sellToken,
          buyToken: swapParams.buyToken,
          sellAmount: formattedAmount, // "0.10" - формат для UI
          slippageTolerance: 1, // 1% slippage tolerance
          chainId: 8453, // Base chain ID
          // КРИТИЧНО: Добавляем recipient для Farcaster wallet
          recipient: walletAddress, // Адрес получателя (кошелек пользователя)
          // КРИТИЧНО: Добавляем deadline для транзакции
          deadline: deadline, // Unix timestamp в секундах
        };
        
        // Сохраняем swapCallParams для использования в catch блоке
        savedSwapCallParams = { ...swapCallParams };
        
        // КРИТИЧНО: Детальное логирование всех параметров перед вызовом
        console.log('📋 [SWAP-PARAMS] Complete swapCallParams object BEFORE swapTokenAsync call:', {
          // Основные параметры
          sellToken: swapCallParams.sellToken,
          buyToken: swapCallParams.buyToken,
          sellAmount: swapCallParams.sellAmount,
          sellAmountType: typeof swapCallParams.sellAmount,
          sellAmountExact: JSON.stringify(swapCallParams.sellAmount),
          
          // Параметры транзакции
          slippageTolerance: swapCallParams.slippageTolerance,
          slippageToleranceType: typeof swapCallParams.slippageTolerance,
          chainId: swapCallParams.chainId,
          chainIdType: typeof swapCallParams.chainId,
          chainIdHex: `0x${swapCallParams.chainId.toString(16)}`, // Base = 0x2105
          recipient: swapCallParams.recipient,
          recipientType: typeof swapCallParams.recipient,
          recipientLength: swapCallParams.recipient?.length,
          deadline: swapCallParams.deadline,
          deadlineType: typeof swapCallParams.deadline,
          deadlineDate: new Date(swapCallParams.deadline * 1000).toISOString(),
          deadlineMinutesFromNow: Math.floor((swapCallParams.deadline - Math.floor(Date.now() / 1000)) / 60),
          
          // Проверка формата для Farcaster wallet
          sellTokenFormat: swapCallParams.sellToken.startsWith('eip155:') ? 'EIP-155 format' : 'Invalid format',
          buyTokenFormat: swapCallParams.buyToken.startsWith('eip155:') ? 'EIP-155 format' : 'Invalid format',
          recipientFormat: swapCallParams.recipient?.startsWith('0x') ? 'Valid address' : 'Invalid address',
          
          // Проверка значений
          isChainIdBase: swapCallParams.chainId === 8453,
          isSlippageValid: swapCallParams.slippageTolerance > 0 && swapCallParams.slippageTolerance <= 100,
          isDeadlineValid: swapCallParams.deadline > Math.floor(Date.now() / 1000),
          isRecipientValid: swapCallParams.recipient && swapCallParams.recipient.length === 42,
          
          // Полный объект для проверки
          fullParams: swapCallParams,
          fullParamsStringified: JSON.stringify(swapCallParams, null, 2),
          
          // Контекст вызова
          walletAddress,
          isConnected,
          userFid: user?.fid,
          timestamp: new Date().toISOString(),
        });
        
        // КРИТИЧНО: Проверяем текущие параметры из swapHookResult перед вызовом
        const currentTokenFrom = (swapHookResult as any)?.tokenFrom;
        const currentTokenTo = (swapHookResult as any)?.tokenTo;
        const currentFromAmount = (swapHookResult as any)?.fromAmount || (swapHookResult as any)?.amount;
        
        console.log('🔍 [SWAP] Current swapHookResult state before call:', {
          tokenFrom: currentTokenFrom,
          tokenTo: currentTokenTo,
          fromAmount: currentFromAmount,
          swapCallParams,
          sellAmountType: typeof swapCallParams.sellAmount,
          sellAmountValue: swapCallParams.sellAmount,
        });
        
        // КРИТИЧНО: Если параметры не установлены в swapHookResult, устанавливаем их еще раз
        if (!currentFromAmount || currentFromAmount === '0' || currentFromAmount === '0.0') {
          console.warn('⚠️ [SWAP] fromAmount not set in swapHookResult, setting it again...');
          if (typeof (swapHookResult as any)?.setFromAmount === 'function') {
            (swapHookResult as any).setFromAmount(formattedAmount);
          } else if ((swapHookResult as any).fromAmount !== undefined) {
            (swapHookResult as any).fromAmount = formattedAmount;
          }
          // Ждем, чтобы параметр успел примениться
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        console.log(`🚀 [TEST] Calling swapTokenAsync with FORMATTED amount:`, {
          ...swapCallParams,
          sellAmountValue: swapCallParams.sellAmount,
          sellAmountExact: JSON.stringify(swapCallParams.sellAmount),
          sellToken: swapCallParams.sellToken,
          buyToken: swapCallParams.buyToken,
          timestamp: new Date().toISOString(),
        });
        
        try {
          console.log(`🚀 [SWAP] About to call swapTokenAsync, checking if it's a function:`, {
            isFunction: typeof swapTokenAsync === 'function',
            swapTokenAsyncType: typeof swapTokenAsync,
            swapTokenAsyncValue: swapTokenAsync,
          });
          
          // КРИТИЧНО: Проверяем, что swapTokenAsync действительно функция
          if (typeof swapTokenAsync !== 'function') {
            throw new Error(`swapTokenAsync is not a function. Type: ${typeof swapTokenAsync}, Value: ${swapTokenAsync}`);
          }
          
          // КРИТИЧНО: Финальная проверка параметров прямо перед вызовом
          console.log(`🚀 [SWAP] FINAL CHECK - Calling swapTokenAsync NOW with params:`, {
            ...swapCallParams,
            paramsStringified: JSON.stringify(swapCallParams),
            // Дополнительная проверка формата
            paramValidation: {
              sellTokenValid: swapCallParams.sellToken?.startsWith('eip155:8453/erc20:'),
              buyTokenValid: swapCallParams.buyToken?.startsWith('eip155:8453/erc20:'),
              sellAmountValid: swapCallParams.sellAmount && swapCallParams.sellAmount !== '0',
              chainIdValid: swapCallParams.chainId === 8453,
              recipientValid: swapCallParams.recipient?.startsWith('0x') && swapCallParams.recipient.length === 42,
              deadlineValid: swapCallParams.deadline > Math.floor(Date.now() / 1000),
              slippageValid: swapCallParams.slippageTolerance > 0,
            },
            // Проверка wagmi/viem состояния
            wagmiState: {
              isConnected,
              walletAddress,
              chainId,
              hasProvider: typeof window !== 'undefined' && !!(window as any).ethereum,
            },
          });
          
          // КРИТИЧНО: Добавляем обработку ошибок прямо при вызове
          // Также логируем ошибки от wagmi/viem transport
          const callStartTime = Date.now(); // Объявляем перед try для использования в catch
          try {
            console.log(`⏳ [SWAP] AWAITING swapTokenAsync call...`);
            
            result = await swapTokenAsync(swapCallParams);
            
            const callDuration = Date.now() - callStartTime;
            console.log(`⏱️ [SWAP] swapTokenAsync call completed in ${callDuration}ms`);
          } catch (callError: any) {
            const callDuration = Date.now() - callStartTime;
            console.error('❌ [SWAP] Error during swapTokenAsync call:', {
              // Основная информация об ошибке
              error: callError,
              message: callError?.message,
              code: callError?.code,
              name: callError?.name,
              stack: callError?.stack,
              
              // Детали вызова
              callDuration: `${callDuration}ms`,
              paramsUsed: swapCallParams,
              
              // Ошибки от wagmi/viem transport
              wagmiError: callError?.cause,
              viemError: callError?.walk,
              transportError: callError?.transport,
              
              // Проверка типа ошибки
              isRpcError: callError?.code && typeof callError.code === 'number',
              isProviderError: callError?.provider,
              isTransactionError: callError?.transaction,
              
              // Дополнительная информация
              errorStringified: JSON.stringify(callError, Object.getOwnPropertyNames(callError)),
              errorKeys: Object.keys(callError || {}),
              
              // Контекст
              walletAddress,
              isConnected,
              chainId,
            });
            
            // Если это ошибка unsupported method, пробуем альтернативный подход
            const errorMessage = callError?.message?.toLowerCase() || '';
            const errorCode = callError?.code;
            
            if (
              errorMessage.includes('unsupported method') || 
              errorMessage.includes('eth_call') ||
              errorCode === -32601 // Method not found
            ) {
              console.warn('⚠️ [SWAP] Unsupported method error - Farcaster wallet limitation');
              console.warn('⚠️ [SWAP] This usually means Farcaster wallet does not support eth_call for quotes');
              throw new Error('Farcaster wallet does not support eth_call. Please try using a different wallet or contact support.');
            }
            
            // Логируем другие типы ошибок
            if (errorMessage.includes('user rejected') || errorCode === 4001) {
              console.log('ℹ️ [SWAP] User rejected transaction - this is expected behavior');
            } else if (errorMessage.includes('insufficient funds')) {
              console.error('❌ [SWAP] Insufficient funds error');
            } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
              console.error('❌ [SWAP] Network/timeout error - check connection');
            }
            
            throw callError;
          }
          
          console.log(`✅ [SWAP] swapTokenAsync returned successfully:`, {
            result,
            resultType: typeof result,
            resultIsNull: result === null,
            resultIsUndefined: result === undefined,
            resultKeys: result ? Object.keys(result) : [],
            resultStringified: JSON.stringify(result),
          });
          
          // КРИТИЧНО: Если результат undefined/null, это может означать, что форма открылась
          if (result === undefined || result === null) {
            console.log(`ℹ️ [SWAP] swapTokenAsync returned ${result} - this usually means swap form opened in wallet`);
            console.log(`ℹ️ [SWAP] Expected amount in form: ${formattedAmount} USDC`);
            console.log(`ℹ️ [SWAP] If amount is not set, check swapHookResult state and parameters`);
            
            // КРИТИЧНО: Проверяем, что параметры действительно установлены
            const checkParams = (swapHookResult as any);
            console.log(`🔍 [SWAP] Final parameter check after swapTokenAsync call:`, {
              tokenFrom: checkParams?.tokenFrom,
              tokenTo: checkParams?.tokenTo,
              fromAmount: checkParams?.fromAmount,
              amount: checkParams?.amount,
              sellAmount: swapCallParams.sellAmount,
            });
          }
        } catch (formatError: any) {
          const errorMessage = formatError?.message?.toLowerCase() || '';
          const errorCode = formatError?.code;
          
          // КРИТИЧНО: Проверяем, является ли это ошибкой unsupported method (eth_call)
          if (
            errorMessage.includes('unsupported method') ||
            errorMessage.includes('eth_call') ||
            errorMessage.includes('method not supported') ||
            errorCode === -32601 // Method not found
          ) {
            console.warn('⚠️ [SWAP] Unsupported method error detected (likely eth_call) - Farcaster wallet limitation');
            console.log('🔄 [SWAP] Attempting fallback: direct transaction without quoter...');
            
            // FALLBACK: Прямая транзакция без quoter (если Farcaster wallet не поддерживает eth_call)
            // Это требует использования прямого вызова контракта Uniswap через sendTransaction
            // Пока что логируем ошибку и предлагаем пользователю использовать другой метод
            throw new Error(
              'Farcaster wallet does not support eth_call required for swap quotes. ' +
              'Please try refreshing the page or contact support for alternative payment methods.'
            );
          }
          
          // Если форматированная строка не работает, пробуем wei
          console.warn(`⚠️ [TEST] Formatted amount "${formattedAmount}" failed:`, {
            error: formatError?.message,
            code: formatError?.code,
            name: formatError?.name,
          });
          
          console.log(`🔄 [TEST] Retrying with WEI amount "${weiAmount}":`);
          swapCallParams = {
            sellToken: swapParams.sellToken,
            buyToken: swapParams.buyToken,
            sellAmount: weiAmount, // "100000" - wei формат
          };
          
          console.log(`🚀 [TEST] Calling swapTokenAsync with WEI amount:`, {
            ...swapCallParams,
            sellAmountValue: swapCallParams.sellAmount,
            sellAmountExact: JSON.stringify(swapCallParams.sellAmount),
            timestamp: new Date().toISOString(),
          });
          
          result = await swapTokenAsync(swapCallParams);
          console.log(`✅ [TEST] swapTokenAsync succeeded with wei amount "${weiAmount}"`);
        }
        
        console.log(`✅ [SWAP] swapTokenAsync returned:`, {
          result,
          resultType: typeof result,
          resultKeys: result ? Object.keys(result) : [],
          hasTxHash: result && (typeof result === 'string' || (typeof result === 'object' && 'transactionHash' in result)),
          amountPassed: formattedAmount,
          timestamp: new Date().toISOString(),
        });
        
        // Дополнительная проверка: если результат undefined или null, это может означать, что форма открылась
        if (!result) {
          console.log(`ℹ️ [SWAP] swapTokenAsync returned undefined/null - swap form should be open in wallet with amount: ${formattedAmount}`);
        }
        
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
        
        const errorMessage = swapError?.message?.toLowerCase() || '';
        const errorCode = swapError?.code;
        
        // КРИТИЧНО: Детальное логирование всех ошибок для диагностики
        console.error('❌ [SWAP] Swap error caught:', {
          message: swapError?.message,
          code: swapError?.code,
          name: swapError?.name,
          stack: swapError?.stack,
          error: swapError,
          errorStringified: JSON.stringify(swapError, Object.getOwnPropertyNames(swapError)),
          swapCallParams: savedSwapCallParams ? {
            sellToken: savedSwapCallParams.sellToken,
            buyToken: savedSwapCallParams.buyToken,
            sellAmount: savedSwapCallParams.sellAmount,
          } : 'not set',
          swapHookResultState: swapHookResult ? {
            tokenFrom: (swapHookResult as any)?.tokenFrom,
            tokenTo: (swapHookResult as any)?.tokenTo,
            fromAmount: (swapHookResult as any)?.fromAmount,
          } : 'not available',
          walletAddress,
          isConnected,
        });
        
        // КРИТИЧНО: Детальная обработка различных типов ошибок
        if (swapError?.message?.includes('user rejected') || swapError?.code === 4001) {
          console.log('ℹ️ [SWAP] User rejected - this is expected behavior');
        } else if (
          errorMessage.includes('unsupported method') ||
          errorMessage.includes('eth_call') ||
          errorMessage.includes('method not supported') ||
          errorCode === -32601
        ) {
          console.error('❌ [SWAP] Unsupported method error - Farcaster wallet does not support eth_call');
          console.error('💡 [SWAP] This is a known limitation of Farcaster smart wallet');
          // Ошибка уже обработана выше, просто логируем
        } else if (
          errorMessage.includes('disconnect') ||
          errorMessage.includes('not connected') ||
          errorCode === 4900
        ) {
          console.error('❌ [SWAP] Wallet disconnected during swap');
          // onError в useSwapToken уже обработает это
        } else {
          console.error('❌ [SWAP] Unexpected error - swap form may not have opened');
        }
        
        throw swapError;
      }

      // Детальное логирование результата swap
      console.log('📊 [SWAP] Swap result:', {
        success: !!result,
        result: result,
        resultType: typeof result,
        resultKeys: result ? Object.keys(result) : [],
        userFid: user.fid,
        sellAmount: `${PURCHASE_AMOUNT_USDC} USDC (${usdcAmountStr} wei)`,
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
      
      console.log('✅ [SWAP] Swap form should be open in wallet now. Waiting for user confirmation...');
      console.log('📋 [SWAP] Expected amount in form:', manualAmount || PURCHASE_AMOUNT_USDC.toString(), 'USDC');
      
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
    setError('Transaction state reset. Please try again.');
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
                  onClick={async () => {
                    try {
                      console.log('🔗 [CONNECT] Starting wallet connection...');
                      
                      // КРИТИЧНО: Проверяем, что мы в Farcaster frame
                      const isInFarcasterFrame = typeof window !== 'undefined' && window.self !== window.top;
                      if (!isInFarcasterFrame) {
                        throw new Error('Please open this app in Farcaster to connect your wallet');
                      }
                      
                      // КРИТИЧНО: Убеждаемся, что SDK инициализирован перед подключением
                      console.log('⏳ [CONNECT] Waiting for SDK initialization...');
                      try {
                        const { sdk } = await import('@farcaster/miniapp-sdk');
                        if (sdk && sdk.actions && typeof sdk.actions.ready === 'function') {
                          await sdk.actions.ready();
                          console.log('✅ [CONNECT] SDK ready() called');
                        }
                      } catch (sdkError: any) {
                        console.warn('⚠️ [CONNECT] SDK ready() not available, continuing anyway:', sdkError?.message);
                      }
                      
                      // КРИТИЧНО: Небольшая задержка для инициализации OnchainKit
                      await new Promise(resolve => setTimeout(resolve, 300));
                      
                      console.log('🔗 [CONNECT] Calling connect with farcasterMiniApp connector...');
                      connect({ connector: farcasterMiniApp() });
                      
                      // Проверяем подключение через 2 секунды
                      setTimeout(() => {
                        if (!isConnected && !isConnecting) {
                          console.warn('⚠️ [CONNECT] Connection may have failed, wallet not connected after 2s');
                          setError('Wallet connection timeout. Please try again.');
                        }
                      }, 2000);
                    } catch (connectError: any) {
                      console.error('❌ [CONNECT] Error connecting wallet:', {
                        error: connectError,
                        message: connectError?.message,
                        code: connectError?.code,
                        name: connectError?.name,
                        stack: connectError?.stack,
                      });
                      
                      let errorMessage = connectError?.message || 'Failed to connect wallet. Please try again.';
                      
                      // Детальная обработка ошибок подключения
                      if (connectError?.message?.includes('not in farcaster')) {
                        errorMessage = 'Please open this app in Farcaster to connect your wallet';
                      } else if (connectError?.message?.includes('user rejected') || connectError?.code === 4001) {
                        errorMessage = 'Connection cancelled by user';
                      } else if (connectError?.message?.includes('timeout')) {
                        errorMessage = 'Connection timeout. Please try again.';
                      }
                      
                      setError(errorMessage);
                      setLastError(errorMessage);
                    }
                  }}
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
                   !lastError.includes('cancelled by user') && 
                   !lastError.includes('Insufficient USDC') &&
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
                <span className="font-semibold">💡 Tip:</span> When the swap form opens, enter <span className="font-bold">0.10 USDC</span> as the amount to swap
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
                // Используем router.replace для навигации внутри Farcaster Mini App iframe
                // Это гарантирует, что мы остаемся в iframe и не открываем новую вкладку
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

