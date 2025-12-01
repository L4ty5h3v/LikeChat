# Анализ потока работы Swap и вызова swapTokenAsync

## 1. Проверки при монтировании компонента (useEffect)

### Проверка авторизации Farcaster
```typescript
// Строки 319-343
useEffect(() => {
  if (!isInitialized) {
    console.log('⏳ [BUY-TOKEN] Waiting for auth initialization...');
    return; // ❌ ОСТАНОВКА: ждем инициализации
  }
  
  if (!user || !user.fid) {
    console.error('❌ [BUY-TOKEN] No user found, redirecting to home...');
    router.push('/');
    return; // ❌ ОСТАНОВКА: нет пользователя
  }

  console.log('✅ [BUY-TOKEN] User loaded:', {
    fid: user.fid,
    username: user.username,
  });
  
  checkProgress(user.fid);
  loadWalletInfo();
}, [router, user, isInitialized]);
```

**Логи:**
- `⏳ [BUY-TOKEN] Waiting for auth initialization...` - если auth не готов
- `❌ [BUY-TOKEN] No user found, redirecting to home...` - если нет user
- `✅ [BUY-TOKEN] User loaded: {fid, username}` - если все ОК

### Проверка chainId
```typescript
// Строки 126-134
useEffect(() => {
  if (chainId && chainId !== 8453) {
    console.warn(`⚠️ [CHAIN] Wrong chain ID: ${chainId}, expected 8453 (Base)`);
    setError(`Please switch to Base network (chain ID: 8453). Current: ${chainId}`);
  } else if (chainId === 8453) {
    console.log('✅ [CHAIN] Correct chain ID: 8453 (Base)');
  }
}, [chainId]);
```

**Логи:**
- `⚠️ [CHAIN] Wrong chain ID: X, expected 8453 (Base)` - если неправильная сеть
- `✅ [CHAIN] Correct chain ID: 8453 (Base)` - если все ОК

### Проверка инициализации SDK
```typescript
// Строки 222-260
useEffect(() => {
  const checkInitialization = async () => {
    const isInFarcasterFrame = window.self !== window.top;
    if (!isInFarcasterFrame) {
      console.log('ℹ️ [INIT] Not in Farcaster frame, skipping initialization check');
      return;
    }
    
    const { sdk } = await import('@farcaster/miniapp-sdk');
    console.log('✅ [INIT] Farcaster SDK loaded:', {
      hasSDK: !!sdk,
      hasActions: !!sdk?.actions,
      hasReady: typeof sdk?.actions?.ready === 'function',
    });
    
    // Проверка OnchainKit и Wagmi
    console.log('✅ [INIT] OnchainKit check:', { hasOnchainKit });
    console.log('✅ [INIT] Wagmi check:', { hasWagmi });
  };
  
  checkInitialization();
}, []);
```

**Логи:**
- `ℹ️ [INIT] Not in Farcaster frame, skipping initialization check` - если не в frame
- `✅ [INIT] Farcaster SDK loaded: {hasSDK, hasActions, hasReady}` - статус SDK
- `✅ [INIT] OnchainKit check: {hasOnchainKit}` - статус OnchainKit
- `✅ [INIT] Wagmi check: {hasWagmi}` - статус Wagmi

### Установка параметров swap при подключении кошелька
```typescript
// Строки 355-429
useEffect(() => {
  if (isConnected && walletAddress && swapHookResult) {
    console.log('🔧 [SWAP-SETUP] Setting up swap parameters when wallet connected:', {
      manualAmount,
      walletAddress,
      isConnected,
      chainId: 8453,
      sellToken: `eip155:8453/erc20:${USDC_CONTRACT_ADDRESS}`,
      buyToken: `eip155:8453/erc20:${MCT_CONTRACT_ADDRESS}`,
      swapHookKeys: Object.keys(swapHookResult || {}),
    });
    
    const setupSwapParams = async () => {
      // ШАГ 1: setTokenFrom(USDC)
      console.log('✅ [SWAP-SETUP] STEP 1: setTokenFrom(USDC)');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // ШАГ 2: setTokenTo(MCT)
      console.log('✅ [SWAP-SETUP] STEP 2: setTokenTo(MCT)');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // ШАГ 3: setFromAmount("0.10")
      console.log('✅ [SWAP-SETUP] STEP 3: setFromAmount("0.10")');
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // ШАГ 4: refreshQuote()
      console.log('✅ [SWAP-SETUP] STEP 4: refreshQuote() called');
      
      console.log('🔍 [SWAP-SETUP] Parameters after setup:', {
        tokenFrom: swapHookResult?.tokenFrom,
        tokenTo: swapHookResult?.tokenTo,
        fromAmount: swapHookResult?.fromAmount,
      });
    };
    
    setupSwapParams();
  }
}, [isConnected, walletAddress, manualAmount, swapHookResult]);
```

**Логи:**
- `🔧 [SWAP-SETUP] Setting up swap parameters when wallet connected:` - начало установки
- `✅ [SWAP-SETUP] STEP 1: setTokenFrom(USDC)` - установка from token
- `✅ [SWAP-SETUP] STEP 2: setTokenTo(MCT)` - установка to token
- `✅ [SWAP-SETUP] STEP 3: setFromAmount("0.10")` - установка суммы
- `✅ [SWAP-SETUP] STEP 4: refreshQuote() called` - обновление quote
- `🔍 [SWAP-SETUP] Parameters after setup:` - финальные параметры

---

## 2. Вызов swapTokenAsync (при нажатии кнопки)

### handleBuyToken → confirmBuyToken
```typescript
// Строки 512-546
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
  
  // Проверки
  if (!user) {
    setError('Please authorize through Farcaster');
    return; // ❌ ОСТАНОВКА
  }
  
  if (!walletAddress || !isConnected) {
    setError('Please connect wallet to purchase token');
    return; // ❌ ОСТАНОВКА
  }
  
  if (usdcBalance.value < usdcAmount) {
    setError(`Insufficient USDC. Required: ${PURCHASE_AMOUNT_USDC} USDC`);
    return; // ❌ ОСТАНОВКА
  }
  
  // Вызов confirmBuyToken
  await confirmBuyToken();
};
```

**Логи:**
- `🛒 [BUYTOKEN] handleBuyToken called: {user, walletAddress, isConnected, ...}` - начало покупки

### confirmBuyToken - основная функция swap
```typescript
// Строки 756-856
const confirmBuyToken = async (isRetry: boolean = false) => {
  // Проверки
  if (!user) {
    setError('User not authorized');
    return; // ❌ ОСТАНОВКА
  }
  
  if (!walletAddress) {
    setError('Wallet not connected');
    return; // ❌ ОСТАНОВКА
  }
  
  if (usdcBalance.value < usdcAmount) {
    setError(`Insufficient USDC...`);
    return; // ❌ ОСТАНОВКА
  }
  
  setLoading(true);
  setIsSwapping(true);
  
  console.log(`🔄 Starting token swap via Farcaster SDK for FID: ${user.fid}`);
  console.log(`💱 Swapping ${PURCHASE_AMOUNT_USDC} USDC to MCT...`);
  console.log(`📊 Current MCT balance: ${currentBalance}`);
  
  // Проверка swapTokenAsync
  console.log('🔍 [SWAP] Checking swapTokenAsync before call:', {
    swapTokenAsyncExists: !!swapTokenAsync,
    swapTokenAsyncType: typeof swapTokenAsync,
    isFunction: typeof swapTokenAsync === 'function',
    swapHookResultKeys: Object.keys(swapHookResult || {}),
  });
  
  if (!swapTokenAsync || typeof swapTokenAsync !== 'function') {
    console.error('❌ [SWAP] swapTokenAsync is not ready:', {
      swapTokenAsync,
      type: typeof swapTokenAsync,
      swapHookResult,
    });
    throw new Error('Swap function not ready. Please try again.');
  }
  
  // Задержка для инициализации
  const delay = isFirstCall ? 800 : 200;
  console.log(`⏳ [SWAP] Waiting ${delay}ms for wallet context initialization...`);
  await new Promise(resolve => setTimeout(resolve, delay));
  
  // Проверка wallet
  console.log('🔍 [SWAP] Wallet state before swap:', {
    walletAddress,
    isConnected,
    userFid: user?.fid,
    swapTokenAsyncReady: !!swapTokenAsync,
  });
  
  if (!walletAddress) {
    throw new Error('Wallet address not ready. Please wait for wallet connection.');
  }
```

**Логи:**
- `🔄 Starting token swap via Farcaster SDK for FID: X`
- `💱 Swapping 0.10 USDC to MCT...`
- `📊 Current MCT balance: X`
- `🔍 [SWAP] Checking swapTokenAsync before call:` - проверка функции
- `❌ [SWAP] swapTokenAsync is not ready:` - если функция не готова
- `⏳ [SWAP] Waiting 800ms for wallet context initialization...` - задержка
- `🔍 [SWAP] Wallet state before swap:` - состояние кошелька

### Установка параметров перед вызовом swapTokenAsync
```typescript
// Строки 949-1034
if (swapHookResult) {
  console.log('🔧 [SWAP] Force-setting swap parameters before calling swapTokenAsync...');
  
  // ШАГ 1: setTokenFrom(USDC)
  console.log('✅ [SWAP] STEP 1: setTokenFrom(USDC)');
  await new Promise(resolve => setTimeout(resolve, 150));
  
  // ШАГ 2: setTokenTo(MCT)
  console.log('✅ [SWAP] STEP 2: setTokenTo(MCT)');
  await new Promise(resolve => setTimeout(resolve, 150));
  
  // ШАГ 3: setFromAmount("0.10")
  console.log('✅ [SWAP] STEP 3: setFromAmount("0.10")');
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // ШАГ 4: refreshQuote()
  console.log('✅ [SWAP] STEP 4: refreshQuote()');
  await new Promise(resolve => setTimeout(resolve, 800));
  
  console.log('🔍 [SWAP] Final parameters verification:', {
    tokenFrom: swapHookResult?.tokenFrom,
    tokenTo: swapHookResult?.tokenTo,
    fromAmount: swapHookResult?.fromAmount,
    isAmountSet: fromAmount && fromAmount !== '0',
  });
}
```

**Логи:**
- `🔧 [SWAP] Force-setting swap parameters before calling swapTokenAsync...`
- `✅ [SWAP] STEP 1: setTokenFrom(USDC)`
- `✅ [SWAP] STEP 2: setTokenTo(MCT)`
- `✅ [SWAP] STEP 3: setFromAmount("0.10")`
- `✅ [SWAP] STEP 4: refreshQuote()`
- `⏳ [SWAP] Waiting 800ms for parameters to apply...`
- `🔍 [SWAP] Final parameters verification:` - проверка параметров

### Вызов swapTokenAsync
```typescript
// Строки 1104-1170
try {
  console.log(`🚀 [SWAP] About to call swapTokenAsync, checking if it's a function:`, {
    isFunction: typeof swapTokenAsync === 'function',
    swapTokenAsyncType: typeof swapTokenAsync,
    swapTokenAsyncValue: swapTokenAsync,
  });
  
  if (typeof swapTokenAsync !== 'function') {
    throw new Error(`swapTokenAsync is not a function. Type: ${typeof swapTokenAsync}`);
  }
  
  console.log(`🚀 [SWAP] Calling swapTokenAsync NOW with params:`, {
    ...swapCallParams,
    paramsStringified: JSON.stringify(swapCallParams),
  });
  
  // ⚠️ КРИТИЧЕСКИЙ МОМЕНТ: ВЫЗОВ swapTokenAsync
  result = await swapTokenAsync(swapCallParams);
  
  console.log(`✅ [SWAP] swapTokenAsync returned successfully:`, {
    result,
    resultType: typeof result,
    resultIsNull: result === null,
    resultIsUndefined: result === undefined,
    resultKeys: result ? Object.keys(result) : [],
  });
  
  if (result === undefined || result === null) {
    console.log(`ℹ️ [SWAP] swapTokenAsync returned ${result} - this usually means swap form opened in wallet`);
    console.log(`ℹ️ [SWAP] Expected amount in form: ${formattedAmount} USDC`);
    console.log(`🔍 [SWAP] Final parameter check after swapTokenAsync call:`, {
      tokenFrom: swapHookResult?.tokenFrom,
      tokenTo: swapHookResult?.tokenTo,
      fromAmount: swapHookResult?.fromAmount,
    });
  }
} catch (callError: any) {
  console.error('❌ [SWAP] Error during swapTokenAsync call:', {
    error: callError,
    message: callError?.message,
    code: callError?.code,
    name: callError?.name,
    stack: callError?.stack,
  });
  
  if (errorMessage.includes('unsupported method') || errorMessage.includes('eth_call')) {
    console.warn('⚠️ [SWAP] Unsupported method error - Farcaster wallet limitation');
    throw new Error('Farcaster wallet does not support eth_call...');
  }
  
  throw callError;
}
```

**Логи:**
- `🚀 [SWAP] About to call swapTokenAsync, checking if it's a function:` - проверка перед вызовом
- `🚀 [SWAP] Calling swapTokenAsync NOW with params:` - **МОМЕНТ ВЫЗОВА**
- `✅ [SWAP] swapTokenAsync returned successfully:` - успешный возврат
- `ℹ️ [SWAP] swapTokenAsync returned undefined/null - this usually means swap form opened in wallet` - форма открылась
- `❌ [SWAP] Error during swapTokenAsync call:` - ошибка при вызове
- `⚠️ [SWAP] Unsupported method error - Farcaster wallet limitation` - ошибка eth_call

---

## 3. Проблемные места

### Проблема 1: swapTokenAsync вызывается при нажатии кнопки, НЕ в useEffect
- ✅ Проверки проходят в useEffect при монтировании
- ❌ swapTokenAsync вызывается только при нажатии кнопки "BUY"
- ⚠️ Между проверками и вызовом может пройти время, состояние может измениться

### Проблема 2: useSwapToken может не быть подключен к Farcaster wallet
- `useSwapToken()` вызывается без параметров
- OnchainKit должен автоматически использовать Farcaster wallet через Wagmi
- Но если Wagmi не подключен правильно, useSwapToken не будет работать

### Проблема 3: Параметры устанавливаются дважды
- Первый раз в useEffect при подключении кошелька
- Второй раз перед вызовом swapTokenAsync
- Если первый раз не сработал, второй может тоже не сработать

### Проблема 4: Задержки могут быть недостаточными
- 800ms для первого вызова
- 150ms между установкой токенов
- 800ms для применения параметров
- Но Farcaster wallet может требовать больше времени

---

## 4. Рекомендации для диагностики

### Проверьте в консоли браузера:

1. **При загрузке страницы:**
   - `✅ [BUY-TOKEN] User loaded:` - есть ли user?
   - `✅ [CHAIN] Correct chain ID: 8453 (Base)` - правильная ли сеть?
   - `✅ [INIT] Farcaster SDK loaded:` - загружен ли SDK?
   - `🔧 [SWAP-SETUP] Setting up swap parameters when wallet connected:` - устанавливаются ли параметры?

2. **При нажатии кнопки "BUY":**
   - `🛒 [BUYTOKEN] handleBuyToken called:` - вызывается ли функция?
   - `🔍 [SWAP] Checking swapTokenAsync before call:` - готова ли функция?
   - `🚀 [SWAP] Calling swapTokenAsync NOW with params:` - вызывается ли swapTokenAsync?
   - `✅ [SWAP] swapTokenAsync returned successfully:` - что возвращает функция?
   - `❌ [SWAP] Error during swapTokenAsync call:` - есть ли ошибки?

3. **Критические проверки:**
   - `swapTokenAsyncExists: true/false` - существует ли функция?
   - `swapTokenAsyncType: "function"/"undefined"/"object"` - какой тип?
   - `swapHookResultKeys: [...]` - какие методы доступны в swapHookResult?
   - `fromAmount: "0.10"/undefined/"0"` - установлена ли сумма?

---

## 5. Возможные решения

### Решение 1: Проверить подключение useSwapToken к Farcaster wallet
```typescript
// Добавить проверку после useSwapToken
useEffect(() => {
  if (swapHookResult) {
    console.log('🔍 [SWAP-HOOK] useSwapToken connection check:', {
      hasSwapTokenAsync: typeof swapHookResult?.swapTokenAsync === 'function',
      hasTokenFrom: swapHookResult?.tokenFrom !== undefined,
      hasTokenTo: swapHookResult?.tokenTo !== undefined,
      hasFromAmount: swapHookResult?.fromAmount !== undefined,
      isConnectedToWallet: isConnected && !!walletAddress,
    });
  }
}, [swapHookResult, isConnected, walletAddress]);
```

### Решение 2: Увеличить задержки
```typescript
// Увеличить задержку перед вызовом swapTokenAsync
const delay = isFirstCall ? 1500 : 500; // Было 800/200
```

### Решение 3: Проверить, что OnchainKitProvider правильно настроен
```typescript
// В _app.tsx должно быть:
<OnchainKitProvider
  chain={base} // chainId 8453
  miniKit={{ enabled: true }}
>
```


