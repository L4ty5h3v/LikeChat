import { createPublicClient, http, encodeFunctionData, decodeAbiParameters, isAddress, type Address } from 'viem';
import { base } from 'viem/chains';

const USDC_ADDRESS_ON_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const WETH_ADDRESS_ON_BASE = '0x4200000000000000000000000000000000000006' as const;

// Uniswap V3 Quoter V2 on Base (same as used in pages/api/quote.ts)
const UNISWAP_V3_QUOTER = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a' as const;

// Use the most reliable RPC available in env; fall back to default Base RPC.
const BASE_RPC_URL =
  process.env.ALCHEMY_BASE_RPC_URL ||
  process.env.BASE_RPC_URL ||
  process.env.BASERPCURL ||
  'https://mainnet.base.org';

const publicClient = createPublicClient({
  chain: base,
  transport: http(BASE_RPC_URL, {
    timeout: 12_000,
    retryCount: 1,
    retryDelay: 1200,
  }),
});

// Uniswap V3 Quoter (ExactInputSingle)
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

const feeTiers: readonly number[] = [10000, 3000, 500];

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const tradableCache = new Map<string, { ok: boolean; checkedAt: number }>();

async function quoteExactInputSingle(
  tokenIn: Address,
  tokenOut: Address,
  fee: number,
  amountIn: bigint
): Promise<bigint | null> {
  try {
    const data = encodeFunctionData({
      abi: quoterAbi,
      functionName: 'quoteExactInputSingle',
      args: [tokenIn, tokenOut, fee, amountIn, 0n],
    });

    const result = await publicClient.call({
      to: UNISWAP_V3_QUOTER,
      data,
    });

    if (!result.data || result.data === '0x') return null;

    const decoded = decodeAbiParameters([{ type: 'uint256', name: 'amountOut' }], result.data);
    const amountOut = decoded[0] as bigint;
    return amountOut > 0n ? amountOut : null;
  } catch {
    return null;
  }
}

async function isTradableOnUniswapV3(
  tokenAddress: Address,
  usdcAmountIn: bigint
): Promise<boolean> {
  // 1) Direct USDC -> TOKEN
  for (const fee of feeTiers) {
    const out = await quoteExactInputSingle(USDC_ADDRESS_ON_BASE, tokenAddress, fee, usdcAmountIn);
    if (out) return true;
  }

  // 2) Two-hop USDC -> WETH -> TOKEN
  for (const fee1 of feeTiers) {
    const wethOut = await quoteExactInputSingle(USDC_ADDRESS_ON_BASE, WETH_ADDRESS_ON_BASE, fee1, usdcAmountIn);
    if (!wethOut) continue;
    for (const fee2 of feeTiers) {
      const tokenOut = await quoteExactInputSingle(WETH_ADDRESS_ON_BASE, tokenAddress, fee2, wethOut);
      if (tokenOut) return true;
    }
  }

  return false;
}

export async function isTokenTradableCached(tokenAddress: string, usdcAmountIn: bigint): Promise<boolean> {
  if (!isAddress(tokenAddress)) return false;
  const key = tokenAddress.toLowerCase();

  const cached = tradableCache.get(key);
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) return cached.ok;

  const ok = await isTradableOnUniswapV3(tokenAddress as Address, usdcAmountIn);
  tradableCache.set(key, { ok, checkedAt: Date.now() });
  return ok;
}


