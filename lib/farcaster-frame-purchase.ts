// Покупка токенов через Farcaster Frame с использованием EIP-5792 walletsendCalls
import { ethers } from 'ethers';

// Константы
// ВАЖНО: После развертывания контракта обновите этот адрес!
const TOKEN_SALE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_SALE_CONTRACT_ADDRESS || '';
const TOKEN_CONTRACT_ADDRESS = '0x04d388da70c32fc5876981097c536c51c8d3d236'; // MCT Token
const USDC_CONTRACT_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC на Base
const BASE_CHAIN_ID = 8453;
const TOKEN_AMOUNT = '100000000000000000'; // 0.10 MCT (18 decimals)
const PRICE_ETH = '100000000000000'; // 0.0001 ETH (18 decimals)
const PRICE_USDC = '250000'; // 0.25 USDC (6 decimals)

// ABI для контракта продажи
const TOKEN_SALE_ABI = [
  'function buyTokensWithETH(uint256 tokenAmount) payable',
  'function buyTokensWithUSDC(uint256 tokenAmount)',
  'function getCostETH(uint256 tokenAmount) view returns (uint256)',
  'function getCostUSDC(uint256 tokenAmount) view returns (uint256)',
];

// ABI для USDC (ERC20)
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

/**
 * Покупка токенов через ETH используя walletsendCalls (EIP-5792)
 */
export async function buyTokensWithETHViaFrame(
  userAddress: string
): Promise<{
  success: boolean;
  calls?: any[];
  error?: string;
}> {
  try {
    if (!TOKEN_SALE_CONTRACT_ADDRESS) {
      throw new Error('Token sale contract not deployed. Please deploy the contract first.');
    }

    const iface = new ethers.Interface(TOKEN_SALE_ABI);
    const tokenAmount = ethers.parseEther('0.10'); // 0.10 MCT
    
    // Формируем данные для транзакции
    const callData = iface.encodeFunctionData('buyTokensWithETH', [tokenAmount]);

    // Формируем батч транзакций для EIP-5792 walletsendCalls
    const calls = [
      {
        to: TOKEN_SALE_CONTRACT_ADDRESS,
        value: PRICE_ETH, // 0.0001 ETH
        data: callData,
      },
    ];

    return {
      success: true,
      calls,
    };
  } catch (error: any) {
    console.error('Error preparing ETH purchase:', error);
    return {
      success: false,
      error: error.message || 'Failed to prepare ETH purchase',
    };
  }
}

/**
 * Покупка токенов через USDC используя walletsendCalls (EIP-5792) с батчем approve + buyTokens
 */
export async function buyTokensWithUSDCViaFrame(
  userAddress: string
): Promise<{
  success: boolean;
  calls?: any[];
  error?: string;
}> {
  try {
    if (!TOKEN_SALE_CONTRACT_ADDRESS) {
      throw new Error('Token sale contract not deployed. Please deploy the contract first.');
    }

    const saleIface = new ethers.Interface(TOKEN_SALE_ABI);
    const usdcIface = new ethers.Interface(ERC20_ABI);

    const tokenAmount = ethers.parseEther('0.10'); // 0.10 MCT
    
    // 1. Approve USDC для контракта продажи
    const approveData = usdcIface.encodeFunctionData('approve', [
      TOKEN_SALE_CONTRACT_ADDRESS,
      ethers.parseUnits(PRICE_USDC, 6), // 0.25 USDC (6 decimals)
    ]);

    // 2. Buy tokens with USDC
    const buyData = saleIface.encodeFunctionData('buyTokensWithUSDC', [tokenAmount]);

    // Формируем батч транзакций для EIP-5792 walletsendCalls
    // Батч: approve + buyTokensWithUSDC
    const calls = [
      {
        to: USDC_CONTRACT_ADDRESS,
        value: '0',
        data: approveData,
      },
      {
        to: TOKEN_SALE_CONTRACT_ADDRESS,
        value: '0',
        data: buyData,
      },
    ];

    return {
      success: true,
      calls,
    };
  } catch (error: any) {
    console.error('Error preparing USDC purchase:', error);
    return {
      success: false,
      error: error.message || 'Failed to prepare USDC purchase',
    };
  }
}

/**
 * Выполнить walletsendCalls через Farcaster провайдер
 */
export async function executeWalletSendCalls(
  calls: any[],
  paymentToken: 'ETH' | 'USDC'
): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
}> {
  try {
    if (typeof window === 'undefined') {
      return {
        success: false,
        error: 'Wallet calls available only on client',
      };
    }

    // Получаем Farcaster провайдер
    const { getEthereumProvider } = await import('@farcaster/miniapp-sdk/dist/ethereumProvider');
    const miniProvider = await getEthereumProvider();
    
    if (!miniProvider) {
      return {
        success: false,
        error: 'Farcaster Wallet not found. Open the app in Farcaster Mini App.',
      };
    }

    // Проверяем поддержку walletsendCalls (EIP-5792)
    if (!miniProvider.request || typeof miniProvider.request !== 'function') {
      return {
        success: false,
        error: 'Wallet does not support wallet_sendCalls',
      };
    }

    // Выполняем walletsendCalls
    // Используем type assertion, так как типы для EIP-5792 могут быть неполными
    const result = await (miniProvider.request as any)({
      method: 'wallet_sendCalls',
      params: [
        {
          version: '1.0',
          chainId: `eip155:${BASE_CHAIN_ID}`,
          calls: calls,
        },
      ],
    });

    console.log('✅ Wallet sendCalls result:', result);

    // walletsendCalls возвращает массив хешей транзакций
    const txHashes = Array.isArray(result) ? result : [result];
    const txHash = txHashes[0]; // Используем первую транзакцию как основную

    return {
      success: true,
      txHash,
    };
  } catch (error: any) {
    console.error('Error executing wallet sendCalls:', error);
    
    let errorMessage = 'Failed to execute transaction';
    if (error.message?.includes('user rejected')) {
      errorMessage = 'Transaction rejected by user';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

