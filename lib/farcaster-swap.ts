// Покупка токена через прямой swap через Farcaster провайдер (как в rips)
import { ethers } from 'ethers';

const USE_USDC_FOR_PAYMENT = false; // false = ETH, true = USDC
const TOKEN_CONTRACT_ADDRESS = '0x04d388da70c32fc5876981097c536c51c8d3d236'; // MCT Token
const DEFAULT_TOKEN_DECIMALS = 18;
const BASE_CHAIN_ID = 8453;

// Покупка токена через Farcaster Swap (прямой swap через провайдер)
export async function buyTokenViaFarcasterSwap(
  userFid: number,
  paymentToken?: 'ETH' | 'USDC'
): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
  verified?: boolean;
}> {
  const selectedPaymentToken = paymentToken || (USE_USDC_FOR_PAYMENT ? 'USDC' : 'ETH');
  
  // Используем прямой swap через провайдер (как в rips)
  // Это более надежно, чем openUrl, так как транзакция выполняется напрямую
  const { buyTokenViaDirectSwap } = await import('@/lib/farcaster-direct-swap');
  return await buyTokenViaDirectSwap(userFid, selectedPaymentToken);
}

// Проверить баланс токена после swap
export async function verifySwapCompletion(
  userAddress: string,
  expectedAmount: string
): Promise<boolean> {
  try {
    const BASE_RPC_URL = 'https://mainnet.base.org';
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);

    const ERC20_ABI = [
      'function balanceOf(address owner) view returns (uint256)',
      'function decimals() view returns (uint8)',
    ];

    const tokenContract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, ERC20_ABI, provider);
    const balance = await tokenContract.balanceOf(userAddress);
    const decimals = await tokenContract.decimals().catch(() => DEFAULT_TOKEN_DECIMALS);
    
    const balanceFormatted = ethers.formatUnits(balance, decimals);
    const expectedAmountNum = parseFloat(expectedAmount);
    const balanceNum = parseFloat(balanceFormatted);

    console.log(`📊 Balance check: ${balanceFormatted} MCT (expected: ${expectedAmount} MCT)`);

    // Проверяем, что баланс увеличился хотя бы на ожидаемое количество
    return balanceNum >= expectedAmountNum;
  } catch (error) {
    console.error('Error verifying swap completion:', error);
    return false;
  }
}

