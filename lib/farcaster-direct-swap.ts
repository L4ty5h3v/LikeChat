// Прямой swap ETH/USDC → MCT через Farcaster провайдер (без внешних URL)
import { ethers } from 'ethers';

// Константы
const TOKEN_CONTRACT_ADDRESS = '0x04d388da70c32fc5876981097c536c51c8d3d236'; // MCT Token
const TOKEN_AMOUNT_TO_BUY = '0.10'; // Покупаем 0.10 MCT
const DEFAULT_TOKEN_DECIMALS = 18;
const BASE_CHAIN_ID = 8453;

// Адреса токенов на Base
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC на Base
const WRAPPED_ETH_ADDRESS = '0x4200000000000000000000000000000000000006'; // WETH на Base

// Uniswap V3 Router на Base
const UNISWAP_V3_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481';

// ABI
const UNISWAP_ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
];

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

// Прямой swap ETH/USDC → MCT через Farcaster провайдер
export async function buyTokenViaDirectSwap(
  userFid: number,
  paymentToken: 'ETH' | 'USDC' = 'ETH'
): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
  verified?: boolean;
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
    const tokenAmountOut = ethers.parseUnits(TOKEN_AMOUNT_TO_BUY, DEFAULT_TOKEN_DECIMALS);

    // Рассчитываем сумму для покупки (примерная)
    const amountIn = paymentToken === 'ETH'
      ? ethers.parseEther('0.0001') // 0.0001 ETH
      : ethers.parseUnits('0.25', 6); // 0.25 USDC

    console.log(`🔄 Direct swap: ${paymentToken} → MCT`);
    console.log(`   Amount In: ${paymentToken === 'ETH' ? ethers.formatEther(amountIn) : ethers.formatUnits(amountIn, 6)} ${paymentToken}`);
    console.log(`   Amount Out: ${TOKEN_AMOUNT_TO_BUY} MCT`);

    // Для USDC: проверяем и делаем approve
    if (paymentToken === 'USDC') {
      const tokenInContract = new ethers.Contract(tokenInAddress, ERC20_ABI, signer);
      const currentAllowance = await tokenInContract.allowance(userAddress, UNISWAP_V3_ROUTER);
      
      if (currentAllowance < amountIn) {
        console.log(`🔄 Approving USDC spending...`);
        const approveTx = await tokenInContract.approve(UNISWAP_V3_ROUTER, amountIn, {
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
    const fee = 3000; // 0.3% fee tier
    const amountOutMinimum = tokenAmountOut * BigInt(95) / BigInt(100); // 5% slippage

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

    console.log('🔄 Sending swap transaction...');

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
