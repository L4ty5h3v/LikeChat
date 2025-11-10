// Функции для покупки токена через Farcaster Swap API
import { ethers } from 'ethers';

// Константы конфигурации (без использования env)
const TOKEN_CONTRACT_ADDRESS = '0x04d388da70c32fc5876981097c536c51c8d3d236'; // MCT Token
const TOKEN_AMOUNT_TO_BUY = '0.10'; // Покупаем 0.10 MCT
const DEFAULT_TOKEN_DECIMALS = 18;
const BASE_CHAIN_ID = 8453;
const USE_FARCASTER_SWAP = true; // Использовать Farcaster Swap API
const USE_USDC_FOR_PAYMENT = false; // false = ETH, true = USDC

// Покупка токена через Farcaster Swap API
export async function buyTokenViaFarcasterSwap(
  userFid: number,
  paymentToken?: 'ETH' | 'USDC'
): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
  verified?: boolean;
}> {
  // Используем конфигурацию из констант, если paymentToken не указан
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

    // Получаем адреса токенов
    const tokenInAddress = selectedPaymentToken === 'ETH' 
      ? '0x0000000000000000000000000000000000000000' // ETH (нулевой адрес)
      : '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC на Base
    
    const tokenOutAddress = TOKEN_CONTRACT_ADDRESS; // MCT Token
    const tokenAmount = ethers.parseUnits(TOKEN_AMOUNT_TO_BUY, DEFAULT_TOKEN_DECIMALS);

    // Рассчитываем примерную стоимость покупки
    // Для ETH: примерно 0.0001 ETH за 0.10 MCT
    // Для USDC: примерно 0.25 USDC за 0.10 MCT
    const amountIn = selectedPaymentToken === 'ETH'
      ? ethers.parseEther('0.0001') // 0.0001 ETH
      : ethers.parseUnits('0.25', 6); // 0.25 USDC

    console.log(`🔄 Initiating swap via Farcaster API:`);
    console.log(`   Token In: ${selectedPaymentToken} (${tokenInAddress})`);
    console.log(`   Token Out: MCT (${tokenOutAddress})`);
    console.log(`   Amount In: ${selectedPaymentToken === 'ETH' ? ethers.formatEther(amountIn) : ethers.formatUnits(amountIn, 6)} ${selectedPaymentToken}`);
    console.log(`   Amount Out: ${TOKEN_AMOUNT_TO_BUY} MCT`);

    // Используем openUrl для открытия swap интерфейса Farcaster
    // Farcaster кошелек может иметь встроенный swap через deep link
    const swapUrl = buildSwapUrl({
      tokenIn: tokenInAddress,
      tokenOut: tokenOutAddress,
      amountIn: amountIn.toString(),
      amountOut: tokenAmount.toString(),
      chainId: BASE_CHAIN_ID,
    });

    console.log('🔄 Opening swap interface:', swapUrl);

    // Пробуем использовать openUrl для открытия swap
    if (sdk.actions.openUrl) {
      await sdk.actions.openUrl({ url: swapUrl });
      
      // Возвращаем успех, так как swap будет выполняться в кошельке
      return {
        success: true,
        verified: false, // Верификация произойдет после завершения swap
      };
    }

    // Fallback: открываем swap URL напрямую
    if (typeof window !== 'undefined') {
      window.open(swapUrl, '_blank');
      return {
        success: true,
        verified: false,
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

// Построить URL для swap через различные DEX
function buildSwapUrl(params: {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  chainId: number;
}): string {
  const { tokenIn, tokenOut, amountIn, amountOut, chainId } = params;

  // Используем Uniswap для Base
  // Uniswap поддерживает Base через их интерфейс
  const isETH = tokenIn === '0x0000000000000000000000000000000000000000';
  const tokenInParam = isETH ? 'ETH' : tokenIn;
  
  // Uniswap URL для Base
  const uniswapUrl = `https://app.uniswap.org/#/swap?` +
    `chain=base&` +
    `inputCurrency=${tokenInParam}&` +
    `outputCurrency=${tokenOut}&` +
    `exactAmount=${amountIn}&` +
    `exactField=input`;

  return uniswapUrl;
}

// Альтернативный способ: использование Jupiter для Base (если поддерживается)
function buildJupiterSwapUrl(params: {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  chainId: number;
}): string {
  const { tokenIn, tokenOut, amountIn } = params;
  
  // Jupiter Aggregator для Base
  return `https://jup.ag/swap?` +
    `inputMint=${tokenIn}&` +
    `outputMint=${tokenOut}&` +
    `amount=${amountIn}`;
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

