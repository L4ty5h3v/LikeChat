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

// ABI for Uniswap V3 QuoterV2 (Base). QuoterV2 returns multiple values.
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
    outputs: [
      { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
      { internalType: 'uint160', name: 'sqrtPriceX96After', type: 'uint160' },
      { internalType: 'uint32', name: 'initializedTicksCrossed', type: 'uint32' },
      { internalType: 'uint256', name: 'gasEstimate', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

function decodeQuoterAmountOut(data: `0x${string}`): bigint {
  // QuoterV2 returns: (uint256 amountOut, uint160, uint32, uint256)
  const decoded = decodeAbiParameters(
    [
      { type: 'uint256', name: 'amountOut' },
      { type: 'uint160', name: 'sqrtPriceX96After' },
      { type: 'uint32', name: 'initializedTicksCrossed' },
      { type: 'uint256', name: 'gasEstimate' },
    ],
    data
  );
  return (decoded[0] as bigint) || 0n;
}

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

    // Fee tiers for pools (1% = 10000, 0.3% = 3000, 0.05% = 500)
    // NOTE: Different legs often exist at different fee tiers (e.g. WETH/USDC at 0.05%/0.3%,
    // and niche tokens at 1%), so we try combinations instead of forcing the same tier.
    const feeTiers = [10000, 3000, 500];
    const feeTiersPreferLow = [500, 3000, 10000];

    if (type === 'price') {
      // Получаем цену 1 MCT в USDC: MCT → WETH → USDC
      const oneToken = 10n ** BigInt(MCT_DECIMALS); // 1 MCT (exact bigint math)

      console.log(`🔍 [API] Fetching MCT price: MCT → WETH → USDC (fully onchain)...`);

      for (const feeMctWeth of feeTiers) {
        let ethAmount: bigint | null = null;
        try {
          // Step 1: 1 MCT → WETH (try higher fee tiers first; niche pools often use 1%)
          const mctToWethData = encodeFunctionData({
            abi: quoterAbi,
            functionName: 'quoteExactInputSingle',
            args: [
              MCT_ADDRESS as `0x${string}`,
              WETH_ADDRESS as `0x${string}`,
              feeMctWeth,
              oneToken,
              0n,
            ],
          });

          const mctToWethResult = await publicClient.call({
            to: UNISWAP_V3_QUOTER as `0x${string}`,
            data: mctToWethData,
          });

          if (!mctToWethResult.data || mctToWethResult.data === '0x') {
            continue;
          }

          ethAmount = decodeQuoterAmountOut(mctToWethResult.data as `0x${string}`);

          if (!ethAmount || ethAmount === 0n) {
            continue;
          }
        } catch (error: any) {
          const errorMsg = error?.message || error?.reason || 'Unknown error';
          const errorString = String(errorMsg).toLowerCase();
          if (
            errorString.includes('429') ||
            errorString.includes('too many requests') ||
            errorString.includes('rate limit') ||
            errorString.includes('http request failed') ||
            errorString.includes('status: 429') ||
            errorString.includes('stf') ||
            errorString.includes('revert') ||
            errorString.includes('missing revert data') ||
            errorString.includes('execution reverted')
          ) {
            continue;
          }
          console.warn(`⚠️ [API] MCT/WETH quote failed for fee ${feeMctWeth}:`, errorMsg);
          continue;
        }

        // Step 2: WETH → USDC (prefer low fee tiers for majors)
        for (const feeWethUsdc of feeTiersPreferLow) {
          try {
            const wethToUsdcData = encodeFunctionData({
              abi: quoterAbi,
              functionName: 'quoteExactInputSingle',
              args: [
                WETH_ADDRESS as `0x${string}`,
                USDC_ADDRESS_ON_BASE as `0x${string}`,
                feeWethUsdc,
                ethAmount!,
                0n,
              ],
            });

            const wethToUsdcResult = await publicClient.call({
              to: UNISWAP_V3_QUOTER as `0x${string}`,
              data: wethToUsdcData,
            });

            if (!wethToUsdcResult.data || wethToUsdcResult.data === '0x') {
              continue;
            }

            const usdcOut = decodeQuoterAmountOut(wethToUsdcResult.data as `0x${string}`);

            if (!usdcOut || usdcOut === 0n) {
              continue;
            }

            const pricePerTokenUSDC = Number(usdcOut) / (10 ** USDC_DECIMALS);
            console.log(
              `✅ [API] MCT price: ${pricePerTokenUSDC.toFixed(6)} USDC per 1 MCT (fees: MCT/WETH ${feeMctWeth / 10000}% → WETH/USDC ${feeWethUsdc / 10000}%)`
            );

            return res.status(200).json({ success: true, pricePerTokenUSDC });
          } catch (error: any) {
            const errorMsg = error?.message || error?.reason || 'Unknown error';
            const errorString = String(errorMsg).toLowerCase();
            if (
              errorString.includes('429') ||
              errorString.includes('too many requests') ||
              errorString.includes('rate limit') ||
              errorString.includes('http request failed') ||
              errorString.includes('status: 429') ||
              errorString.includes('stf') ||
              errorString.includes('revert') ||
              errorString.includes('missing revert data') ||
              errorString.includes('execution reverted')
            ) {
              continue;
            }
            console.warn(
              `⚠️ [API] WETH/USDC quote failed for fee ${feeWethUsdc} (after MCT/WETH fee ${feeMctWeth}):`,
              errorMsg
            );
          }
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
      const usdcAmountWei = BigInt(Math.round(usdcAmount * 10 ** USDC_DECIMALS));

      console.log(`🔍 [API] Fetching MCT amount for ${usdcAmount} USDC: USDC → WETH → MCT...`);

      const feeTiersUsdcWeth = feeTiersPreferLow; // majors usually at low fee tiers
      const feeTiersWethMct = feeTiers; // niche pools often at higher fee tiers

      for (const feeUsdcWeth of feeTiersUsdcWeth) {
        let ethAmount: bigint | null = null;
        try {
          // Step 1: USDC → WETH
          const usdcToWethData = encodeFunctionData({
            abi: quoterAbi,
            functionName: 'quoteExactInputSingle',
            args: [
              USDC_ADDRESS_ON_BASE as `0x${string}`,
              WETH_ADDRESS as `0x${string}`,
              feeUsdcWeth,
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

          ethAmount = decodeQuoterAmountOut(usdcToWethResult.data as `0x${string}`);

          if (!ethAmount || ethAmount === 0n) {
            continue;
          }
        } catch (error: any) {
          const errorMsg = error?.message || error?.reason || 'Unknown error';
          const errorString = String(errorMsg).toLowerCase();
          if (
            errorString.includes('429') ||
            errorString.includes('too many requests') ||
            errorString.includes('rate limit') ||
            errorString.includes('http request failed') ||
            errorString.includes('status: 429') ||
            errorString.includes('stf') ||
            errorString.includes('revert') ||
            errorString.includes('missing revert data') ||
            errorString.includes('execution reverted')
          ) {
            continue;
          }
          console.warn(`⚠️ [API] USDC/WETH quote failed for fee ${feeUsdcWeth}:`, errorMsg);
          continue;
        }

        // Step 2: WETH → MCT (try higher tiers first)
        for (const feeWethMct of feeTiersWethMct) {
          try {
            const wethToMctData = encodeFunctionData({
              abi: quoterAbi,
              functionName: 'quoteExactInputSingle',
              args: [
                WETH_ADDRESS as `0x${string}`,
                MCT_ADDRESS as `0x${string}`,
                feeWethMct,
                ethAmount!,
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

            const mctAmount = decodeQuoterAmountOut(wethToMctResult.data as `0x${string}`);

            if (!mctAmount || mctAmount === 0n) {
              continue;
            }

            console.log(
              `✅ [API] USDC → WETH → MCT: ${(Number(mctAmount) / 1e18).toFixed(6)} MCT for ${usdcAmount} USDC (fees: USDC/WETH ${feeUsdcWeth / 10000}% → WETH/MCT ${feeWethMct / 10000}%)`
            );

            return res.status(200).json({ success: true, mctAmount: mctAmount.toString() });
          } catch (error: any) {
            const errorMsg = error?.message || error?.reason || 'Unknown error';
            const errorString = String(errorMsg).toLowerCase();
            if (
              errorString.includes('429') ||
              errorString.includes('too many requests') ||
              errorString.includes('rate limit') ||
              errorString.includes('http request failed') ||
              errorString.includes('status: 429') ||
              errorString.includes('stf') ||
              errorString.includes('revert') ||
              errorString.includes('missing revert data') ||
              errorString.includes('execution reverted')
            ) {
              continue;
            }
            console.warn(
              `⚠️ [API] WETH/MCT quote failed for fee ${feeWethMct} (after USDC/WETH fee ${feeUsdcWeth}):`,
              errorMsg
            );
          }
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

