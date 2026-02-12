// Прямой swap ETH/USDC → MCT через Farcaster провайдер (без внешних URL)
import { ethers } from 'ethers';

// Константы
const TOKEN_CONTRACT_ADDRESS = '0x04d388da70c32fc5876981097c536c51c8d3d236'; // MCT Token
const DEFAULT_TOKEN_DECIMALS = 18;
const BASE_CHAIN_ID = 8453;
const PURCHASE_AMOUNT_USD = 0.10; // Покупаем токенов на $0.10

// Адреса токенов на Base
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC на Base
const WRAPPED_ETH_ADDRESS = '0x4200000000000000000000000000000000000006'; // WETH на Base

// Uniswap V3 Router на Base (SwapRouter02)
const UNISWAP_V3_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481';
const UNISWAP_V3_FACTORY = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD';

// Uniswap V3 Quoter на Base (для получения цены)
const UNISWAP_V3_QUOTER = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a';

// Base public RPC for READ calls (Farcaster wallet provider may not support eth_call reliably)
const BASE_READ_RPC_URL =
  process.env.NEXT_PUBLIC_BASE_RPC_URL ||
  'https://base-rpc.publicnode.com';

// ABI для Uniswap V3 Router
const UNISWAP_ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
  'function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)) external payable returns (uint256 amountOut)',
  'function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountInMaximum, uint256 amountOut, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountIn)',
  'function multicall(uint256 deadline, bytes[] calldata data) external payable returns (bytes[] memory results)',
  'function unwrapWETH9(uint256 amountMinimum, address recipient) external payable',
];

// ABI для Uniswap V3 Quoter
const UNISWAP_QUOTER_ABI = [
  'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)',
  'function quoteExactOutputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountOut, uint160 sqrtPriceLimitX96) external returns (uint256 amountIn)',
];

const UNISWAP_FACTORY_ABI = [
  'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address)',
];

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

async function waitForAllowance(opts: {
  tokenAddress: string;
  owner: string;
  spender: string;
  minAllowance: bigint;
  readProvider: ethers.JsonRpcProvider;
  timeoutMs?: number;
}): Promise<boolean> {
  const { tokenAddress, owner, spender, minAllowance, readProvider, timeoutMs = 60_000 } = opts;
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, readProvider);
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const allowance: bigint = await token.allowance(owner, spender);
      if (allowance >= minAllowance) return true;
    } catch {
      // ignore and retry
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

async function getAvailableFeeTiers(opts: {
  tokenA: string;
  tokenB: string;
  feeCandidates: number[];
  readProvider: ethers.JsonRpcProvider;
}): Promise<number[]> {
  const { tokenA, tokenB, feeCandidates, readProvider } = opts;
  const factory = new ethers.Contract(UNISWAP_V3_FACTORY, UNISWAP_FACTORY_ABI, readProvider);
  const available: number[] = [];

  for (const fee of feeCandidates) {
    try {
      const pool: string = await factory.getPool(tokenA, tokenB, fee);
      if (pool && pool !== ethers.ZeroAddress) {
        available.push(fee);
      }
    } catch {
      // ignore and keep probing other fees
    }
  }
  return available;
}

// Получить цену ETH в USD
async function getEthPriceUsd(): Promise<number> {
  try {
    // Пробуем получить цену через публичный API
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const data = await response.json();
    if (data.ethereum?.usd) {
      return data.ethereum.usd;
    }
  } catch (error) {
    console.warn('Failed to fetch ETH price from CoinGecko, using fallback');
  }
  
  // Fallback: примерная цена ETH (можно обновить)
  return 3500; // Примерная цена ETH в USD
}

// Получить количество токенов, которое можно купить на $0.10
// Использует API вместо прямых вызовов RPC (избегает eth_call в wallet)
export async function getTokenAmountForPurchase(
  paymentToken: 'ETH' | 'USDC' = 'ETH'
): Promise<string | null> {
  try {
    if (paymentToken === 'USDC') {
      // Используем API для получения котировки USDC → MCT
      const response = await fetch('/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'amount',
          usdcAmount: PURCHASE_AMOUNT_USD,
        }),
      });

      if (!response.ok) {
        console.error('❌ Failed to get quote from API');
        return null;
      }

      const data = await response.json();
      
      if (data.success && data.mctAmount) {
        const mctAmountBigInt = BigInt(data.mctAmount);
        return ethers.formatUnits(mctAmountBigInt, DEFAULT_TOKEN_DECIMALS);
      }
      
      return null;
    } else {
      // Для ETH: используем API для получения цены, затем рассчитываем
      const ethPriceUsd = await getEthPriceUsd();
      const ethAmountNeeded = PURCHASE_AMOUNT_USD / ethPriceUsd;
      // Для ETH лучше использовать прямой swap через Farcaster SDK (useSwapToken)
      // Эта функция используется только для USDC
      return null;
    }
  } catch (error) {
    console.error('❌ Error getting token amount from API:', error);
    return null;
  }
}

// Прямой swap ETH/USDC → MCT через Farcaster провайдер
export async function buyTokenViaDirectSwap(
  userFid: number,
  paymentToken: 'ETH' | 'USDC' = 'ETH'
): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
  verified?: boolean;
  tokenAmount?: string; // Количество полученных токенов
}> {
  try {
    if (typeof window === 'undefined') {
      return {
        success: false,
        error: 'Swap is only available on the client',
      };
    }

    // Получаем Farcaster провайдер
    const { getEthereumProvider } = await import('@farcaster/miniapp-sdk/dist/ethereumProvider');
    const miniProvider = await getEthereumProvider();
    
    if (!miniProvider) {
      return {
        success: false,
        error: 'Farcaster Wallet not found. Open this inside the Farcaster Mini App.',
      };
    }

    const provider = new ethers.BrowserProvider(miniProvider as any);
    const signer = await provider.getSigner();
    const userAddress = await signer.getAddress();

    // Use a public RPC for read-only calls (allowance/balance/decimals)
    const readProvider = new ethers.JsonRpcProvider(BASE_READ_RPC_URL);

    // Проверяем сеть
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== BASE_CHAIN_ID) {
      await switchToBaseNetwork();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Адреса токенов
    const tokenInAddress = paymentToken === 'ETH' 
      ? WRAPPED_ETH_ADDRESS // WETH для swap
      : USDC_ADDRESS; // USDC
    
    const tokenOutAddress = TOKEN_CONTRACT_ADDRESS; // MCT Token

    // Рассчитываем amountIn на основе $0.10 USD по рыночному курсу
    // Используем API для получения котировки (избегаем eth_call в wallet)
    let amountIn: bigint;
    let tokenAmountOut: bigint = BigInt(0);
    
    if (paymentToken === 'USDC') {
      // Для USDC просто используем $0.10 = 0.10 USDC
      amountIn = ethers.parseUnits(PURCHASE_AMOUNT_USD.toString(), 6); // 0.10 USDC
      
      // Получаем количество токенов через API (избегаем eth_call)
      console.log(`🔍 Getting quote via API: ${PURCHASE_AMOUNT_USD} USDC → MCT...`);
      try {
        const response = await fetch('/api/quote', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'amount',
            usdcAmount: PURCHASE_AMOUNT_USD,
          }),
        });

        if (!response.ok) {
          let details = '';
          try {
            const maybeJson = await response.json().catch(() => null);
            if (maybeJson && typeof maybeJson === 'object') {
              const msg = (maybeJson as any).error || (maybeJson as any).message;
              if (typeof msg === 'string' && msg.trim()) details = `: ${msg.trim()}`;
            }
          } catch {}
          throw new Error(`Quote API request failed (HTTP ${response.status})${details}`);
        }

        const data = await response.json();
        
        if (data.success && data.mctAmount) {
          tokenAmountOut = BigInt(data.mctAmount);
          console.log(`💰 API Quote: ${ethers.formatUnits(amountIn, 6)} USDC → ${ethers.formatUnits(tokenAmountOut, DEFAULT_TOKEN_DECIMALS)} MCT`);
        } else {
          throw new Error(data.error || 'Quote API returned an error');
        }
      } catch (error: any) {
        console.error('❌ Error getting quote from API:', error);
        // Quote failures (rate limits/RPC hiccups) should NOT hard-block the swap.
        // We'll proceed with amountOutMinimum=0 and let the router handle execution.
        console.warn('⚠️ Proceeding without quote (amountOutMinimum=0).');
        tokenAmountOut = 0n;
      }
    } else {
      // Для ETH: получаем цену ETH в USD и рассчитываем amountIn
      // Для ETH swaps рекомендуется использовать useSwapToken из onchainkit (уже используется в buyToken.tsx)
      // Эта функция оставлена для обратной совместимости, но для ETH лучше использовать прямой путь
      const ethPriceUsd = await getEthPriceUsd();
      const ethAmountNeeded = PURCHASE_AMOUNT_USD / ethPriceUsd;
      amountIn = ethers.parseEther(ethAmountNeeded.toFixed(18));
      
      // Для ETH не требуется API quote, так как прямой swap WETH -> MCT выполняется через Router
      // Используем расчетный amountOut на основе цены (можно улучшить через API в будущем)
      // Пока используем приблизительное значение для ETH swaps
      const estimatedMCTPerEth = 1000; // Примерное значение, можно улучшить через API
      tokenAmountOut = ethers.parseUnits((Number(amountIn) / 1e18 * estimatedMCTPerEth).toFixed(DEFAULT_TOKEN_DECIMALS), DEFAULT_TOKEN_DECIMALS);
      
      console.log(`💰 ETH Quote (estimated): ${ethers.formatEther(amountIn)} ETH ($${PURCHASE_AMOUNT_USD}) → ${ethers.formatUnits(tokenAmountOut, DEFAULT_TOKEN_DECIMALS)} MCT`);
    }

    console.log(`🔄 Direct swap: ${paymentToken} → MCT`);
    console.log(`   Purchase amount: $${PURCHASE_AMOUNT_USD} USD`);
    console.log(`   Token In: ${tokenInAddress}`);
    console.log(`   Token Out: ${tokenOutAddress}`);
    if (paymentToken === 'USDC') {
      console.log(`   Amount In: ${ethers.formatUnits(amountIn, 6)} ${paymentToken}`);
      console.log(`   Amount Out: ${ethers.formatUnits(tokenAmountOut, DEFAULT_TOKEN_DECIMALS)} MCT`);
    } else {
      // Для ETH: amountIn уже рассчитан выше
      console.log(`   Amount In: ${ethers.formatEther(amountIn)} ${paymentToken}`);
      console.log(`   Amount Out: ${ethers.formatUnits(tokenAmountOut, DEFAULT_TOKEN_DECIMALS)} MCT`);
    }

    // Для USDC: проверяем и делаем approve
    if (paymentToken === 'USDC') {
      // IMPORTANT: allowance() is a read (eth_call). Use public RPC, not Farcaster wallet provider.
      const tokenInRead = new ethers.Contract(tokenInAddress, ERC20_ABI, readProvider);
      const currentAllowance = await tokenInRead.allowance(userAddress, UNISWAP_V3_ROUTER);
      
      if (currentAllowance < amountIn) {
        console.log(`🔄 Approving USDC spending...`);
        const tokenInContract = new ethers.Contract(tokenInAddress, ERC20_ABI, signer);
        const approveTx = await tokenInContract.approve(UNISWAP_V3_ROUTER, ethers.MaxUint256, {
          gasLimit: 100000,
        });
        
        console.log('✅ Approval transaction sent:', approveTx.hash);
        // Farcaster provider may not support eth_getTransactionReceipt; confirm via public RPC instead.
        // IMPORTANT: do not proceed to swap until allowance is visible onchain, otherwise swap can revert.
        try {
          const receipt = await readProvider.waitForTransaction(approveTx.hash, 1, 180_000);
          if (receipt?.status === 0) {
            throw new Error('Approval transaction failed');
          }
        } catch (e) {
          console.warn('⚠️ Approval receipt wait failed/timed out, will still poll allowance...', e);
        }

        const ok = await waitForAllowance({
          tokenAddress: tokenInAddress,
          owner: userAddress,
          spender: UNISWAP_V3_ROUTER,
          minAllowance: amountIn,
          readProvider,
          timeoutMs: 90_000,
        });
        if (!ok) {
          throw new Error('Approval is still pending. Please try again in a few seconds.');
        }
        console.log('✅ Approval visible onchain (allowance updated)');
      } else {
        console.log('✅ USDC already approved');
      }
    }

    // Формируем swap транзакцию через Uniswap Router
    const router = new ethers.Contract(UNISWAP_V3_ROUTER, UNISWAP_ROUTER_ABI, signer);
    
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 минут
    
    // Fee tiers for Uniswap V3 pools
    // Common tiers: 0.01% (100), 0.05% (500), 0.3% (3000), 1% (10000)
    const feeTiers = [10000, 3000, 500, 100];
    let lastError: any = null;
    
    // Slippage:
    // - if we have a quote: use 5% buffer
    // - if quote failed: do not hard-block swap (minOut=0)
    const amountOutMinimum =
      tokenAmountOut && tokenAmountOut > 0n
        ? (tokenAmountOut * 95n) / 100n
        : 0n;

    // Для ETH: сначала пробуем прямой swap WETH -> MCT (пул существует!)
    if (paymentToken === 'ETH') {
      console.log('🔄 Trying direct swap: WETH -> MCT (pool exists on Uniswap V3 with 1% fee)...');

      // Probe pools first to avoid sending transactions that wallet knows will fail.
      const wethMctFees = await getAvailableFeeTiers({
        tokenA: WRAPPED_ETH_ADDRESS,
        tokenB: tokenOutAddress,
        feeCandidates: feeTiers,
        readProvider,
      });
      if (wethMctFees.length === 0) {
        throw new Error('No WETH/MCT pool found on Uniswap V3 Base');
      }

      // Пробуем прямой swap только по существующим fee tiers
      for (const fee of wethMctFees) {
        try {
          const swapParams = {
            tokenIn: WRAPPED_ETH_ADDRESS, // WETH
            tokenOut: tokenOutAddress, // MCT
            fee: fee,
            recipient: userAddress,
            deadline: deadline,
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum,
            sqrtPriceLimitX96: 0,
          };

          console.log(`🔄 Trying direct swap WETH -> MCT with fee tier ${fee} (${fee / 10000}%)...`);

          // Отправляем транзакцию через Farcaster провайдер
          // Это покажет окно транзакции в Farcaster кошельке
          const tx = await router.exactInputSingle(swapParams, {
            value: amountIn, // Отправляем ETH, который конвертируется в WETH
            gasLimit: 500000,
          });

          console.log('✅ Direct swap transaction sent:', tx.hash);
          console.log('📋 Transaction will be visible in Farcaster wallet history');

          // Wait for confirmation via public RPC (Farcaster provider may not support receipts)
          const receipt = await readProvider.waitForTransaction(tx.hash, 1, 180_000);

          if (receipt?.status === 1) {
            console.log('✅ Direct swap confirmed');
            
            // Проверяем баланс токенов
            const tokenOutContract = new ethers.Contract(tokenOutAddress, ERC20_ABI, readProvider);
            const balance = await tokenOutContract.balanceOf(userAddress);
            const decimals = await tokenOutContract.decimals().catch(() => DEFAULT_TOKEN_DECIMALS);
            const balanceFormatted = ethers.formatUnits(balance, decimals);
            
            console.log(`📊 New token balance: ${balanceFormatted} MCT`);

            return {
              success: true,
              txHash: tx.hash,
              verified: true,
              tokenAmount: ethers.formatUnits(tokenAmountOut, DEFAULT_TOKEN_DECIMALS),
            };
          } else if (receipt?.status === 0) {
            throw new Error('Transaction failed');
          } else {
            // No receipt yet (timeout) — treat as pending; UI can verify by balance later.
            console.log('ℹ️ Swap pending (no receipt yet). Returning tx hash.');
            return {
              success: true,
              txHash: tx.hash,
              verified: false,
              tokenAmount: tokenAmountOut > 0n ? ethers.formatUnits(tokenAmountOut, DEFAULT_TOKEN_DECIMALS) : undefined,
            };
          }
        } catch (swapError: any) {
          console.warn(`⚠️ Direct swap failed with fee ${fee}:`, swapError.message);
          lastError = swapError;
          
          // Если это не ошибка ликвидности, пробуем следующий fee tier
          if (!swapError.message?.includes('STF') && !swapError.message?.includes('SPL')) {
            continue;
          }
        }
      }
      
      console.warn('⚠️ All direct swap attempts failed, trying multi-hop swap as fallback...');
      
      // Fallback: пробуем multi-hop swap через USDC
      const feeCombinations = [
        [10000, 10000], // 1% -> 1%
        [3000, 10000],  // 0.3% -> 1%
        [10000, 3000],  // 1% -> 0.3%
      ];

      for (const [fee1, fee2] of feeCombinations) {
        try {
          console.log(`🔄 Trying multi-hop swap: WETH -> USDC -> MCT (fees: ${fee1/10000}% -> ${fee2/10000}%)...`);
          
          const path = ethers.solidityPacked(
            ['address', 'uint24', 'address', 'uint24', 'address'],
            [WRAPPED_ETH_ADDRESS, fee1, USDC_ADDRESS, fee2, tokenOutAddress]
          );

          const tx = await router.exactInput(
            {
              path: path,
              recipient: userAddress,
              deadline: deadline,
              amountIn: amountIn,
              amountOutMinimum: amountOutMinimum,
            },
            {
              value: amountIn,
              gasLimit: 700000,
            }
          );

          console.log('✅ Multi-hop swap transaction sent:', tx.hash);
        const receipt = await readProvider.waitForTransaction(tx.hash, 1, 180_000);

        if (receipt?.status === 1) {
            console.log('✅ Multi-hop swap confirmed');
            return {
              success: true,
              txHash: tx.hash,
              verified: true,
              tokenAmount: ethers.formatUnits(tokenAmountOut, DEFAULT_TOKEN_DECIMALS),
            };
        } else if (receipt?.status === 0) {
          throw new Error('Transaction failed');
        } else {
          console.log('ℹ️ Swap pending (no receipt yet). Returning tx hash.');
          return {
            success: true,
            txHash: tx.hash,
            verified: false,
            tokenAmount: tokenAmountOut > 0n ? ethers.formatUnits(tokenAmountOut, DEFAULT_TOKEN_DECIMALS) : undefined,
          };
          }
        } catch (multiHopError: any) {
          console.warn(`⚠️ Multi-hop swap failed:`, multiHopError.message);
          lastError = multiHopError;
          continue;
        }
      }
    }

    // Для USDC: пробуем прямой swap USDC -> MCT
    const usdcMctDirectFees = await getAvailableFeeTiers({
      tokenA: tokenInAddress,
      tokenB: tokenOutAddress,
      feeCandidates: feeTiers,
      readProvider,
    });

    if (usdcMctDirectFees.length > 0) {
      for (const fee of usdcMctDirectFees) {
        try {
          const swapParams = {
            tokenIn: tokenInAddress,
            tokenOut: tokenOutAddress,
            fee: fee,
            recipient: userAddress,
            deadline: deadline,
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum,
            sqrtPriceLimitX96: 0,
          };

          console.log(`🔄 Trying swap with fee tier ${fee} (${fee / 10000}%)...`);

          // Отправляем транзакцию
          const tx = await router.exactInputSingle(swapParams, {
            value: paymentToken === 'USDC' ? 0 : amountIn, // Для USDC value = 0, для ETH = amountIn
            gasLimit: 500000,
          });

          console.log('✅ Swap transaction sent:', tx.hash);

          // Wait for confirmation via public RPC (Farcaster provider may not support receipts)
          const receipt = await readProvider.waitForTransaction(tx.hash, 1, 180_000);

          if (receipt?.status === 1) {
            console.log('✅ Swap transaction confirmed');
            
            // Проверяем баланс токенов
            const tokenOutContract = new ethers.Contract(tokenOutAddress, ERC20_ABI, readProvider);
            const balance = await tokenOutContract.balanceOf(userAddress);
            const decimals = await tokenOutContract.decimals().catch(() => DEFAULT_TOKEN_DECIMALS);
            const balanceFormatted = ethers.formatUnits(balance, decimals);
            
            console.log(`📊 New token balance: ${balanceFormatted} MCT`);

            return {
              success: true,
              txHash: tx.hash,
              verified: true,
            };
          } else if (receipt?.status === 0) {
            throw new Error('Transaction failed');
          } else {
            console.log('ℹ️ Swap pending (no receipt yet). Returning tx hash.');
            return {
              success: true,
              txHash: tx.hash,
              verified: false,
            };
          }
        } catch (swapError: any) {
          console.warn(`⚠️ Swap failed with fee ${fee}:`, swapError.message);
          lastError = swapError;
          
          // Если это не ошибка ликвидности, пробуем следующий fee tier
          if (!swapError.message?.includes('STF') && !swapError.message?.includes('SPL')) {
            continue;
          }
        }
      }
    } else if (paymentToken === 'USDC') {
      console.log('ℹ️ No direct USDC/MCT pool found. Skipping direct route and trying multi-hop via WETH.');
    }

    // USDC fallback: try multi-hop USDC -> WETH -> MCT (direct pool may not exist)
    if (paymentToken === 'USDC') {
      console.warn('⚠️ Direct USDC->MCT failed for all fee tiers, trying multi-hop via WETH...');
      const feeTiersUsdcWethCandidates = [100, 500, 3000, 10000]; // majors usually low tiers
      const feeTiersWethMctCandidates = [10000, 3000, 500, 100];  // niche often high tier
      const feeTiersUsdcWeth = await getAvailableFeeTiers({
        tokenA: USDC_ADDRESS,
        tokenB: WRAPPED_ETH_ADDRESS,
        feeCandidates: feeTiersUsdcWethCandidates,
        readProvider,
      });
      const feeTiersWethMct = await getAvailableFeeTiers({
        tokenA: WRAPPED_ETH_ADDRESS,
        tokenB: tokenOutAddress,
        feeCandidates: feeTiersWethMctCandidates,
        readProvider,
      });

      if (feeTiersUsdcWeth.length === 0 || feeTiersWethMct.length === 0) {
        throw new Error('No valid USDC->WETH->MCT pool route found on Uniswap V3 Base');
      }

      for (const fee1 of feeTiersUsdcWeth) {
        for (const fee2 of feeTiersWethMct) {
          try {
            const path = ethers.solidityPacked(
              ['address', 'uint24', 'address', 'uint24', 'address'],
              [USDC_ADDRESS, fee1, WRAPPED_ETH_ADDRESS, fee2, tokenOutAddress]
            );

            console.log(`🔄 Trying multi-hop USDC -> WETH -> MCT (fees: ${fee1 / 10000}% -> ${fee2 / 10000}%)...`);

            const tx = await router.exactInput(
              {
                path,
                recipient: userAddress,
                deadline,
                amountIn,
                amountOutMinimum,
              },
              {
                value: 0,
                gasLimit: 700000,
              }
            );

            console.log('✅ Multi-hop USDC swap transaction sent:', tx.hash);
            const receipt = await readProvider.waitForTransaction(tx.hash, 1, 180_000);

            if (receipt?.status === 1) {
              console.log('✅ Multi-hop USDC swap confirmed');
              return {
                success: true,
                txHash: tx.hash,
                verified: true,
              };
            } else if (receipt?.status === 0) {
              throw new Error('Transaction failed');
            } else {
              console.log('ℹ️ Swap pending (no receipt yet). Returning tx hash.');
              return { success: true, txHash: tx.hash, verified: false };
            }
          } catch (e: any) {
            lastError = e;
            continue;
          }
        }
      }
    }
    
    // Если все fee tiers не сработали, выбрасываем последнюю ошибку
    throw lastError || new Error('Swap failed with all fee tiers');
  } catch (error: any) {
    console.error('❌ Error in direct swap:', error);
    
    let errorMessage = 'Error executing swap';
    
    if (error.message?.includes('user rejected')) {
      errorMessage = 'Transaction cancelled by user';
    } else if (error.message?.includes('insufficient funds')) {
      errorMessage = 'Insufficient funds for swap';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage,
      verified: false,
    };
  }
}

// Переключить сеть на Base
async function switchToBaseNetwork(): Promise<void> {
  if (typeof window === 'undefined' || !(window as any).ethereum) {
    throw new Error('Ethereum provider not found');
  }

  const ethereum = (window as any).ethereum;
  const BASE_CHAIN_ID_HEX = '0x2105';

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_CHAIN_ID_HEX }],
    });
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: BASE_CHAIN_ID_HEX,
          chainName: 'Base',
          nativeCurrency: {
            name: 'Ethereum',
            symbol: 'ETH',
            decimals: 18,
          },
          rpcUrls: ['https://mainnet.base.org'],
          blockExplorerUrls: ['https://basescan.org'],
        }],
      });
    } else {
      throw switchError;
    }
  }
}
