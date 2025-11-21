import type { NextApiRequest, NextApiResponse } from 'next';
import { createPublicClient, http, encodeFunctionData, decodeAbiParameters } from 'viem';
import { base } from 'viem/chains';

// Константы
const MCT_ADDRESS = '0x04d388da70c32fc5876981097c536c51c8d3d236'; // MCT Token
const WETH_ADDRESS = '0x4200000000000000000000000000000000000006'; // WETH на Base
const USDC_ADDRESS_ON_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC на Base (6 decimals)
// ⚠️ ВАЖНО: Uniswap V3 Quoter V2 на Base - правильный адрес
// Проверено: 0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a (без последней 5)
const UNISWAP_V3_QUOTER = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a' as `0x${string}`;
const MCT_DECIMALS = 18;
const USDC_DECIMALS = 6;

// Создаем public client для Base (используем надежный RPC)
// Приоритет: Alchemy > BASE_RPC_URL > BASERPCURL > дефолтный Base RPC
// ⚠️ ВАЖНО: Используем надежный RPC для стабильности (Alchemy рекомендуется)
const BASE_RPC_URL = process.env.ALCHEMY_BASE_RPC_URL || 
                      process.env.BASE_RPC_URL || 
                      process.env.BASERPCURL || 
                      'https://mainnet.base.org';

console.log('🔗 [QUOTE-API] Using RPC endpoint:', BASE_RPC_URL.replace(/\/\/.*@/, '//***@')); // Скрываем ключи в логах

const publicClient = createPublicClient({
  chain: base,
  transport: http(BASE_RPC_URL, {
    timeout: 15000, // 15 секунд таймаут
    retryCount: 1, // 1 попытка при ошибке (чтобы не усугублять rate limiting)
    retryDelay: 2000, // 2 секунды задержка между попытками
  }),
});

// ABI для Uniswap V3 Quoter (упрощенный формат)
const quoterAbi = [
  {
    inputs: [
      { internalType: 'address', name: 'tokenIn', type: 'address' },
      { internalType: 'address', name: 'tokenOut', type: 'address' },
      { internalType: 'uint24', name: 'fee', type: 'uint24' },
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'uint160', name: 'sqrtPriceLimitX96', type: 'uint160' },
    ],
    name: 'quoteExactInputSingle',
    outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// Типы для запроса/ответа
type QuoteRequest = {
  type: 'price' | 'amount'; // price = получить цену 1 MCT в USDC, amount = получить количество MCT за USDC
  usdcAmount?: number; // Для type='amount': количество USDC
};

type QuoteResponse = {
  success: boolean;
  pricePerTokenUSDC?: number; // Цена 1 MCT в USDC (для type='price')
  mctAmount?: string; // Количество MCT (для type='amount')
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<QuoteResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { type, usdcAmount = 0.10 }: QuoteRequest = req.body;

    // Fee tiers для пулов (пробуем разные комиссии: 1% = 10000, 0.3% = 3000, 0.05% = 500)
    const feeTiers = [10000, 3000, 500];
    
    // Threshold для фильтрации слабых пулов
    const MIN_ETH_THRESHOLD = BigInt('10000000000000000'); // 0.01 ETH в wei
    const MIN_USDC_THRESHOLD = BigInt('10000'); // 0.01 USDC (6 decimals)

    if (type === 'price') {
      // Получаем цену 1 MCT в USDC: MCT → WETH → USDC
      const oneToken = BigInt(10 ** MCT_DECIMALS); // 1 MCT

      console.log(`🔍 [API] Fetching MCT price: MCT → WETH → USDC (fully onchain)...`);

      for (const fee of feeTiers) {
        try {
          // Шаг 1: 1 MCT → WETH
          const mctToWethData = encodeFunctionData({
            abi: quoterAbi,
            functionName: 'quoteExactInputSingle',
            args: [
              MCT_ADDRESS as `0x${string}`,
              WETH_ADDRESS as `0x${string}`,
              fee,
              oneToken,
              0n, // sqrtPriceLimitX96 = 0
            ],
          });

          const mctToWethResult = await publicClient.call({
            to: UNISWAP_V3_QUOTER as `0x${string}`,
            data: mctToWethData,
          });

          if (!mctToWethResult.data || mctToWethResult.data === '0x') {
            console.warn(`⚠️ [API] Quote returned no data for MCT/WETH fee ${fee}`);
            continue;
          }

          // Декодируем результат: первый параметр - uint256 amountOut
          const mctToWethDecoded = decodeAbiParameters(
            [{ type: 'uint256', name: 'amountOut' }],
            mctToWethResult.data
          );
          const ethAmount = mctToWethDecoded[0] as bigint;

          if (!ethAmount || ethAmount === 0n) {
            console.warn(`⚠️ [API] Quote returned zero for MCT/WETH fee ${fee}`);
            continue;
          }

          if (ethAmount < MIN_ETH_THRESHOLD) {
            console.warn(`⚠️ [API] MCT/WETH quote too low for fee ${fee}`);
            continue;
          }

          console.log(`✅ [API] MCT → WETH: ${Number(ethAmount) / 1e18} WETH per 1 MCT (fee: ${fee/10000}%)`);

          // Шаг 2: WETH → USDC (используем тот же fee tier)
          const wethToUsdcData = encodeFunctionData({
            abi: quoterAbi,
            functionName: 'quoteExactInputSingle',
            args: [
              WETH_ADDRESS as `0x${string}`,
              USDC_ADDRESS_ON_BASE as `0x${string}`,
              fee,
              ethAmount,
              0n, // sqrtPriceLimitX96 = 0
            ],
          });

          const wethToUsdcResult = await publicClient.call({
            to: UNISWAP_V3_QUOTER as `0x${string}`,
            data: wethToUsdcData,
          });

          if (!wethToUsdcResult.data || wethToUsdcResult.data === '0x') {
            console.warn(`⚠️ [API] Quote returned no data for WETH/USDC fee ${fee}`);
            continue;
          }

          // Декодируем результат: первый параметр - uint256 amountOut
          const wethToUsdcDecoded = decodeAbiParameters(
            [{ type: 'uint256', name: 'amountOut' }],
            wethToUsdcResult.data
          );
          const usdcAmount = wethToUsdcDecoded[0] as bigint;

          if (!usdcAmount || usdcAmount === 0n) {
            console.warn(`⚠️ [API] Quote returned zero for WETH/USDC fee ${fee}`);
            continue;
          }

          if (usdcAmount < MIN_USDC_THRESHOLD) {
            console.warn(`⚠️ [API] WETH/USDC quote too low for fee ${fee}`);
            continue;
          }

          const pricePerTokenUSDC = Number(usdcAmount) / (10 ** USDC_DECIMALS);
          
          console.log(`✅ [API] WETH → USDC: ${pricePerTokenUSDC.toFixed(6)} USDC`);
          console.log(`✅ [API] Final MCT price: ${pricePerTokenUSDC.toFixed(6)} USDC per 1 MCT (fee: ${fee/10000}%)`);

          return res.status(200).json({
            success: true,
            pricePerTokenUSDC,
          });
        } catch (error: any) {
          const errorMsg = error?.message || error?.reason || 'Unknown error';
          const errorString = String(errorMsg).toLowerCase();
          
          // Обработка rate limiting (429)
          if (errorString.includes('429') || errorString.includes('too many requests') || errorString.includes('rate limit')) {
            console.warn(`⚠️ [API] Rate limit hit for fee ${fee}, skipping...`);
            continue;
          }
          
          // Обработка HTTP ошибок
          if (errorString.includes('http request failed') || errorString.includes('status: 429')) {
            console.warn(`⚠️ [API] HTTP error for fee ${fee} (likely rate limit), skipping...`);
            continue;
          }
          
          // Обработка revert ошибок (пул не существует или нет ликвидности)
          if (errorString.includes('stf') || errorString.includes('revert') || errorString.includes('missing revert data') || errorString.includes('execution reverted')) {
            console.warn(`⚠️ [API] Execution reverted for fee ${fee} (pool may not exist), skipping...`);
            continue;
          }
          
          console.warn(`⚠️ [API] Quote failed for fee ${fee}:`, errorMsg);
        }
      }

      // Если все fee tiers провалились, возвращаем ошибку, но не критическую
      console.error('❌ [API] All fee tiers failed. Possible reasons: rate limiting, no liquidity, or RPC issues.');
      return res.status(500).json({
        success: false,
        error: 'Failed to get quote from Uniswap. This may be due to rate limiting or lack of liquidity. Please try again later.',
      });
    } else if (type === 'amount') {
      // Получаем количество MCT за usdcAmount USDC: USDC → WETH → MCT
      const usdcAmountWei = BigInt(Math.floor(usdcAmount * (10 ** USDC_DECIMALS)));

      console.log(`🔍 [API] Fetching MCT amount for ${usdcAmount} USDC: USDC → WETH → MCT...`);

      for (const fee of feeTiers) {
        try {
          // Шаг 1: USDC → WETH
          const usdcToWethData = encodeFunctionData({
            abi: quoterAbi,
            functionName: 'quoteExactInputSingle',
            args: [
              USDC_ADDRESS_ON_BASE as `0x${string}`,
              WETH_ADDRESS as `0x${string}`,
              fee,
              usdcAmountWei,
              0n,
            ],
          });

          const usdcToWethResult = await publicClient.call({
            to: UNISWAP_V3_QUOTER as `0x${string}`,
            data: usdcToWethData,
          });

          if (!usdcToWethResult.data || usdcToWethResult.data === '0x') {
            continue;
          }

          // Декодируем результат: первый параметр - uint256 amountOut
          const usdcToWethDecoded = decodeAbiParameters(
            [{ type: 'uint256', name: 'amountOut' }],
            usdcToWethResult.data
          );
          const ethAmount = usdcToWethDecoded[0] as bigint;

          if (!ethAmount || ethAmount === 0n || ethAmount < MIN_ETH_THRESHOLD) {
            continue;
          }

          // Шаг 2: WETH → MCT
          const wethToMctData = encodeFunctionData({
            abi: quoterAbi,
            functionName: 'quoteExactInputSingle',
            args: [
              WETH_ADDRESS as `0x${string}`,
              MCT_ADDRESS as `0x${string}`,
              fee,
              ethAmount,
              0n,
            ],
          });

          const wethToMctResult = await publicClient.call({
            to: UNISWAP_V3_QUOTER as `0x${string}`,
            data: wethToMctData,
          });

          if (!wethToMctResult.data || wethToMctResult.data === '0x') {
            continue;
          }

          // Декодируем результат: первый параметр - uint256 amountOut
          const wethToMctDecoded = decodeAbiParameters(
            [{ type: 'uint256', name: 'amountOut' }],
            wethToMctResult.data
          );
          const mctAmount = wethToMctDecoded[0] as bigint;

          if (!mctAmount || mctAmount === 0n) {
            continue;
          }

          console.log(`✅ [API] USDC → WETH → MCT: ${Number(mctAmount) / 1e18} MCT for ${usdcAmount} USDC (fee: ${fee/10000}%)`);

          return res.status(200).json({
            success: true,
            mctAmount: mctAmount.toString(),
          });
        } catch (error: any) {
          const errorMsg = error?.message || error?.reason || 'Unknown error';
          const errorString = String(errorMsg).toLowerCase();
          
          // Обработка rate limiting (429)
          if (errorString.includes('429') || errorString.includes('too many requests') || errorString.includes('rate limit')) {
            console.warn(`⚠️ [API] Rate limit hit for fee ${fee}, skipping...`);
            continue;
          }
          
          // Обработка HTTP ошибок
          if (errorString.includes('http request failed') || errorString.includes('status: 429')) {
            console.warn(`⚠️ [API] HTTP error for fee ${fee} (likely rate limit), skipping...`);
            continue;
          }
          
          // Обработка revert ошибок (пул не существует или нет ликвидности)
          if (errorString.includes('stf') || errorString.includes('revert') || errorString.includes('missing revert data') || errorString.includes('execution reverted')) {
            console.warn(`⚠️ [API] Execution reverted for fee ${fee} (pool may not exist), skipping...`);
            continue;
          }
          
          console.warn(`⚠️ [API] Quote failed for fee ${fee}:`, errorMsg);
        }
      }

      // Если все fee tiers провалились, возвращаем ошибку, но не критическую
      console.error('❌ [API] All fee tiers failed. Possible reasons: rate limiting, no liquidity, or RPC issues.');
      return res.status(500).json({
        success: false,
        error: 'Failed to get quote from Uniswap. This may be due to rate limiting or lack of liquidity. Please try again later.',
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid type. Use "price" or "amount"',
      });
    }
  } catch (error: any) {
    const errorMsg = error?.message || error?.reason || 'Unknown error';
    const errorString = String(errorMsg).toLowerCase();
    
    // Специальная обработка rate limiting
    if (errorString.includes('429') || errorString.includes('too many requests') || errorString.includes('rate limit')) {
      console.error('❌ [API] Rate limit error in quote handler:', errorMsg);
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Please try again in a few moments.',
      });
    }
    
    console.error('❌ [API] Error in quote handler:', error);
    return res.status(500).json({
      success: false,
      error: errorMsg || 'Internal server error',
    });
  }
}

