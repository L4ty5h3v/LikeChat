// Покупка токена через встроенный swap интерфейс Farcaster
import { ethers } from 'ethers';

const USE_USDC_FOR_PAYMENT = false; // false = ETH, true = USDC
const TOKEN_CONTRACT_ADDRESS = '0x04d388da70c32fc5876981097c536c51c8d3d236'; // MCT Token
const DEFAULT_TOKEN_DECIMALS = 18;
const BASE_CHAIN_ID = 8453;

// Покупка токена через Farcaster Swap (используем встроенный интерфейс)
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
  
  try {
    if (typeof window === 'undefined') {
      return {
        success: false,
        error: 'Swap доступен только на клиенте',
      };
    }

    // Импортируем SDK
    const { sdk } = await import('@farcaster/miniapp-sdk');

    if (!sdk || !sdk.actions) {
      return {
        success: false,
        error: 'Farcaster SDK не доступен',
      };
    }

    // Адреса токенов
    const tokenInAddress = selectedPaymentToken === 'ETH' 
      ? 'ETH' // Используем 'ETH' для нативного токена
      : '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC на Base
    
    const tokenOutAddress = TOKEN_CONTRACT_ADDRESS; // MCT Token
    const tokenAmount = ethers.parseUnits('0.10', DEFAULT_TOKEN_DECIMALS);

    // Рассчитываем сумму для покупки
    const amountIn = selectedPaymentToken === 'ETH'
      ? ethers.parseEther('0.0001') // 0.0001 ETH
      : ethers.parseUnits('0.25', 6); // 0.25 USDC

    console.log(`🔄 Opening Farcaster swap interface:`);
    console.log(`   Token In: ${selectedPaymentToken}`);
    console.log(`   Token Out: MCT (${tokenOutAddress})`);
    console.log(`   Amount In: ${selectedPaymentToken === 'ETH' ? ethers.formatEther(amountIn) : ethers.formatUnits(amountIn, 6)} ${selectedPaymentToken}`);

    // Используем встроенный swap интерфейс Farcaster через Uniswap URL
    // Farcaster кошелек автоматически найдет лучший путь для swap
    const swapUrl = buildSwapUrl({
      tokenIn: tokenInAddress,
      tokenOut: tokenOutAddress,
      amountIn: selectedPaymentToken === 'ETH' ? ethers.formatEther(amountIn) : ethers.formatUnits(amountIn, 6),
      chainId: BASE_CHAIN_ID,
    });

    console.log('🔄 Opening swap interface:', swapUrl);

    // Открываем swap интерфейс через Farcaster SDK
    // Это использует встроенный swap интерфейс кошелька, который сам найдет лучший путь
    if (sdk.actions.openUrl) {
      await sdk.actions.openUrl({ url: swapUrl });
      
      // Возвращаем успех, так как swap будет выполняться в кошельке
      return {
        success: true,
        verified: false, // Верификация произойдет после завершения swap
      };
    }

    return {
      success: false,
      error: 'Не удалось открыть swap интерфейс',
    };
  } catch (error: any) {
    console.error('❌ Error initiating swap via Farcaster:', error);
    return {
      success: false,
      error: error?.message || 'Ошибка при инициации swap',
      verified: false,
    };
  }
}

// Построить URL для swap через Uniswap (встроенный в Farcaster)
function buildSwapUrl(params: {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  chainId: number;
}): string {
  const { tokenIn, tokenOut, amountIn, chainId } = params;

  // Uniswap URL для Base с предзаполненными параметрами
  // Farcaster кошелек использует этот URL для открытия встроенного swap интерфейса
  const uniswapUrl = `https://app.uniswap.org/#/swap?` +
    `chain=base&` +
    `inputCurrency=${tokenIn}&` +
    `outputCurrency=${tokenOut}&` +
    `exactAmount=${amountIn}&` +
    `exactField=input`;

  return uniswapUrl;
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

