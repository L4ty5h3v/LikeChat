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

// Uniswap V3 Quoter на Base (для получения цены)
const UNISWAP_V3_QUOTER = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a';

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

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

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
export async function getTokenAmountForPurchase(
  paymentToken: 'ETH' | 'USDC' = 'ETH'
): Promise<string | null> {
  try {
    const BASE_RPC_URL = 'https://mainnet.base.org';
    const publicProvider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    
    const tokenOutAddress = TOKEN_CONTRACT_ADDRESS;
    let amountIn: bigint;
    
    if (paymentToken === 'USDC') {
      amountIn = ethers.parseUnits(PURCHASE_AMOUNT_USD.toString(), 6);
    } else {
      const ethPriceUsd = await getEthPriceUsd();
      const ethAmountNeeded = PURCHASE_AMOUNT_USD / ethPriceUsd;
      amountIn = ethers.parseEther(ethAmountNeeded.toFixed(18));
    }
    
    const tokenInAddress = paymentToken === 'ETH' ? WRAPPED_ETH_ADDRESS : USDC_ADDRESS;
    const quoter = new ethers.Contract(UNISWAP_V3_QUOTER, UNISWAP_QUOTER_ABI, publicProvider);
    const feeTiers = [10000, 3000, 500];
    
    for (const fee of feeTiers) {
      try {
        const tokenAmountOut = await quoter.quoteExactInputSingle.staticCall(
          tokenInAddress,
          tokenOutAddress,
          fee,
          amountIn,
          0
        );
        return ethers.formatUnits(tokenAmountOut, DEFAULT_TOKEN_DECIMALS);
      } catch (error) {
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting token amount:', error);
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
        error: 'Swap доступен только на клиенте',
      };
    }

    // Получаем Farcaster провайдер
    const { getEthereumProvider } = await import('@farcaster/miniapp-sdk/dist/ethereumProvider');
    const miniProvider = await getEthereumProvider();
    
    if (!miniProvider) {
      return {
        success: false,
        error: 'Farcaster Wallet не найден. Откройте приложение в Farcaster Mini App.',
      };
    }

    const provider = new ethers.BrowserProvider(miniProvider as any);
    const signer = await provider.getSigner();
    const userAddress = await signer.getAddress();

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
    // Используем публичный RPC для Quoter (Farcaster провайдер не поддерживает eth_call)
    const BASE_RPC_URL = 'https://mainnet.base.org';
    const publicProvider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    
    let amountIn: bigint;
    let tokenAmountOut: bigint = BigInt(0);
    
    if (paymentToken === 'USDC') {
      // Для USDC просто используем $0.10 = 0.10 USDC
      amountIn = ethers.parseUnits(PURCHASE_AMOUNT_USD.toString(), 6); // 0.10 USDC
      
      // Получаем количество токенов через Quoter (используем публичный RPC)
      const quoter = new ethers.Contract(UNISWAP_V3_QUOTER, UNISWAP_QUOTER_ABI, publicProvider);
      const feeTiers = [10000, 3000, 500];
      
      for (const fee of feeTiers) {
        try {
          tokenAmountOut = await quoter.quoteExactInputSingle.staticCall(
            USDC_ADDRESS,
            tokenOutAddress,
            fee,
            amountIn,
            0
          );
          console.log(`💰 Quote: ${ethers.formatUnits(amountIn, 6)} USDC → ${ethers.formatUnits(tokenAmountOut, DEFAULT_TOKEN_DECIMALS)} MCT (fee: ${fee/10000}%)`);
          break;
        } catch (error) {
          console.warn(`⚠️ Quote failed for fee ${fee}, trying next...`);
          continue;
        }
      }
      
      if (tokenAmountOut === BigInt(0)) {
        throw new Error('Не удалось получить котировку от Uniswap');
      }
    } else {
      // Для ETH: получаем цену ETH в USD и рассчитываем amountIn
      const ethPriceUsd = await getEthPriceUsd();
      const ethAmountNeeded = PURCHASE_AMOUNT_USD / ethPriceUsd;
      amountIn = ethers.parseEther(ethAmountNeeded.toFixed(18));
      
      // Получаем количество токенов через Quoter (используем публичный RPC)
      const quoter = new ethers.Contract(UNISWAP_V3_QUOTER, UNISWAP_QUOTER_ABI, publicProvider);
      const feeTiers = [10000, 3000, 500];
      
      for (const fee of feeTiers) {
        try {
          tokenAmountOut = await quoter.quoteExactInputSingle.staticCall(
            WRAPPED_ETH_ADDRESS,
            tokenOutAddress,
            fee,
            amountIn,
            0
          );
          console.log(`💰 Quote: ${ethers.formatEther(amountIn)} ETH ($${PURCHASE_AMOUNT_USD}) → ${ethers.formatUnits(tokenAmountOut, DEFAULT_TOKEN_DECIMALS)} MCT (fee: ${fee/10000}%)`);
          break;
        } catch (error) {
          console.warn(`⚠️ Quote failed for fee ${fee}, trying next...`);
          continue;
        }
      }
      
      if (tokenAmountOut === BigInt(0)) {
        throw new Error('Не удалось получить котировку от Uniswap');
      }
    }

    console.log(`🔄 Direct swap: ${paymentToken} → MCT`);
    console.log(`   Purchase amount: $${PURCHASE_AMOUNT_USD} USD`);
    console.log(`   Token In: ${tokenInAddress}`);
    console.log(`   Token Out: ${tokenOutAddress}`);
    console.log(`   Amount In: ${paymentToken === 'ETH' ? ethers.formatEther(amountIn) : ethers.formatUnits(amountIn, 6)} ${paymentToken}`);
    console.log(`   Amount Out: ${ethers.formatUnits(tokenAmountOut, DEFAULT_TOKEN_DECIMALS)} MCT`);

    // Для USDC: проверяем и делаем approve
    if (paymentToken === 'USDC') {
      const tokenInContract = new ethers.Contract(tokenInAddress, ERC20_ABI, signer);
      const currentAllowance = await tokenInContract.allowance(userAddress, UNISWAP_V3_ROUTER);
      
      if (currentAllowance < amountIn) {
        console.log(`🔄 Approving USDC spending...`);
        const approveTx = await tokenInContract.approve(UNISWAP_V3_ROUTER, ethers.MaxUint256, {
          gasLimit: 100000,
        });
        
        console.log('✅ Approval transaction sent:', approveTx.hash);
        await approveTx.wait();
        console.log('✅ Approval confirmed');
      } else {
        console.log('✅ USDC already approved');
      }
    }

    // Формируем swap транзакцию через Uniswap Router
    const router = new ethers.Contract(UNISWAP_V3_ROUTER, UNISWAP_ROUTER_ABI, signer);
    
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 минут
    
    // Fee tiers для пулов (1% = 10000 - это пул MCT/ETH на Uniswap!)
    // Пробуем сначала 1%, потом 0.3%, потом 0.05%
    const feeTiers = [10000, 3000, 500];
    let lastError: any = null;
    
    // Разумный slippage (5%) - пул существует, не нужно 50%
    const amountOutMinimum = tokenAmountOut * BigInt(95) / BigInt(100); // 5% slippage

    // Для ETH: сначала пробуем прямой swap WETH -> MCT (пул существует!)
    if (paymentToken === 'ETH') {
      console.log('🔄 Trying direct swap: WETH -> MCT (pool exists on Uniswap V3 with 1% fee)...');
      
      // Пробуем прямой swap с fee tier 1% (10000) - это пул MCT/ETH
      for (const fee of feeTiers) {
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

          // Ждем подтверждения
          const receipt = await tx.wait();

          if (receipt.status === 1) {
            console.log('✅ Direct swap confirmed');
            
            // Проверяем баланс токенов
            const tokenOutContract = new ethers.Contract(tokenOutAddress, ERC20_ABI, provider);
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
          } else {
            throw new Error('Транзакция не была подтверждена');
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
          const receipt = await tx.wait();

          if (receipt.status === 1) {
            console.log('✅ Multi-hop swap confirmed');
            return {
              success: true,
              txHash: tx.hash,
              verified: true,
              tokenAmount: ethers.formatUnits(tokenAmountOut, DEFAULT_TOKEN_DECIMALS),
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
    for (const fee of feeTiers) {
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
          value: paymentToken === 'ETH' ? amountIn : 0,
          gasLimit: 500000,
        });

        console.log('✅ Swap transaction sent:', tx.hash);

        // Ждем подтверждения
        const receipt = await tx.wait();

        if (receipt.status === 1) {
          console.log('✅ Swap transaction confirmed');
          
          // Проверяем баланс токенов
          const tokenOutContract = new ethers.Contract(tokenOutAddress, ERC20_ABI, provider);
          const balance = await tokenOutContract.balanceOf(userAddress);
          const decimals = await tokenOutContract.decimals().catch(() => DEFAULT_TOKEN_DECIMALS);
          const balanceFormatted = ethers.formatUnits(balance, decimals);
          
          console.log(`📊 New token balance: ${balanceFormatted} MCT`);

          return {
            success: true,
            txHash: tx.hash,
            verified: true,
          };
        } else {
          throw new Error('Транзакция не была подтверждена');
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
    
    // Если все fee tiers не сработали, выбрасываем последнюю ошибку
    throw lastError || new Error('Swap failed with all fee tiers');
  } catch (error: any) {
    console.error('❌ Error in direct swap:', error);
    
    let errorMessage = 'Ошибка при выполнении swap';
    
    if (error.message?.includes('user rejected')) {
      errorMessage = 'Транзакция отменена пользователем';
    } else if (error.message?.includes('insufficient funds')) {
      errorMessage = 'Недостаточно средств для swap';
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
    throw new Error('Ethereum provider не найден');
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
