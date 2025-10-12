// Web3 функции для покупки токена Миссис Крипто
import { ethers } from 'ethers';

const TOKEN_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS || '0x04D388DA70C32FC5876981097c536c51c8d3D236';
const TOKEN_PRICE_USD = parseFloat(process.env.NEXT_PUBLIC_TOKEN_PRICE_USD || '0.1');
const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '8453'); // Base mainnet

// ABI для покупки токена (может быть swap или buy функция)
const TOKEN_ABI = [
  'function buy() payable',
  'function swap() payable', 
  'function getPrice() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
];

// Получить провайдер
export function getProvider(): ethers.BrowserProvider | null {
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    return new ethers.BrowserProvider((window as any).ethereum);
  }
  return null;
}

// Подключить кошелек
export async function connectWallet(): Promise<string | null> {
  try {
    const provider = getProvider();
    if (!provider) {
      // Для демо режима возвращаем тестовый адрес
      console.log('MetaMask не установлен, используем демо режим');
      return '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6'; // Тестовый адрес
    }

    const accounts = await provider.send('eth_requestAccounts', []);
    return accounts[0];
  } catch (error) {
    console.error('Error connecting wallet:', error);
    // В случае ошибки возвращаем тестовый адрес
    return '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';
  }
}

// Получить баланс кошелька
export async function getBalance(address: string): Promise<string> {
  try {
    const provider = getProvider();
    if (!provider) return '0';

    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
  } catch (error) {
    console.error('Error getting balance:', error);
    return '0';
  }
}

// Конвертировать USD в ETH (примерно, нужен оракул для точной цены)
async function getEthAmountForUsd(usdAmount: number): Promise<string> {
  try {
    // В реальном приложении использовать Chainlink или другой оракул
    // Для примера используем фиксированную цену ETH = $2500
    const ETH_PRICE_USD = 2500;
    const ethAmount = usdAmount / ETH_PRICE_USD;
    return ethAmount.toFixed(18);
  } catch (error) {
    console.error('Error converting USD to ETH:', error);
    return '0';
  }
}

// Купить токен
export async function buyToken(): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
}> {
  try {
    const provider = getProvider();
    if (!provider) {
      throw new Error('Провайдер Web3 не найден');
    }

    const signer = await provider.getSigner();
    const address = await signer.getAddress();

    // Проверить сеть
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== CHAIN_ID) {
      throw new Error(`Пожалуйста, переключитесь на сеть Chain ID ${CHAIN_ID}`);
    }

    // Получить контракт
    const contract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_ABI, signer);

    // Получить сумму в ETH
    const ethAmount = await getEthAmountForUsd(TOKEN_PRICE_USD);
    const value = ethers.parseEther(ethAmount);

    // Попробовать разные функции покупки
    let tx;
    try {
      // Сначала попробуем buy()
      tx = await contract.buy({ value });
    } catch (buyError) {
      try {
        // Если buy() не работает, попробуем swap()
        tx = await contract.swap({ value });
      } catch (swapError) {
        throw new Error('Contract does not support buy() or swap() functions. Please check the contract address and ABI.');
      }
    }
    
    // Дождаться подтверждения
    await tx.wait();

    return {
      success: true,
      txHash: tx.hash,
    };
  } catch (error: any) {
    console.error('Error buying token:', error);
    return {
      success: false,
      error: error.message || 'Ошибка при покупке токена',
    };
  }
}

// Проверить баланс токена
export async function checkTokenBalance(address: string): Promise<string> {
  try {
    const provider = getProvider();
    if (!provider) return '0';

    const contract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_ABI, provider);
    const balance = await contract.balanceOf(address);
    
    return ethers.formatEther(balance);
  } catch (error) {
    console.error('Error checking token balance:', error);
    return '0';
  }
}

// Получить информацию о токене
export async function getTokenInfo(): Promise<{
  name: string;
  symbol: string;
  address: string;
  decimals: number;
}> {
  try {
    const provider = getProvider();
    if (!provider) {
      throw new Error('Провайдер Web3 не найден');
    }

    const contract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_ABI, provider);
    
    const [decimals] = await Promise.all([
      contract.decimals().catch(() => 18)
    ]);

    return {
      name: 'Mrs Crypto',
      symbol: '$MCT',
      address: TOKEN_CONTRACT_ADDRESS,
      decimals: Number(decimals)
    };
  } catch (error: any) {
    console.error('Error getting token info:', error);
    return {
      name: 'Mrs Crypto',
      symbol: '$MCT',
      address: TOKEN_CONTRACT_ADDRESS,
      decimals: 18
    };
  }
}

// Проверить транзакцию
export async function verifyTransaction(txHash: string): Promise<boolean> {
  try {
    const provider = getProvider();
    if (!provider) return false;

    const receipt = await provider.getTransactionReceipt(txHash);
    return receipt !== null && receipt.status === 1;
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return false;
  }
}

// Получить адрес кошелька
export async function getWalletAddress(): Promise<string | null> {
  try {
    const provider = getProvider();
    if (!provider) return null;

    const signer = await provider.getSigner();
    return await signer.getAddress();
  } catch (error) {
    console.error('Error getting wallet address:', error);
    return null;
  }
}

