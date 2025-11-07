// Web3 функции для покупки токена Миссис Крипто через Base
import { ethers } from 'ethers';

const TOKEN_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS || '0x454b4180bc715ba6a8568a16f1f9a4b114a329a6';
const TOKEN_SALE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_SALE_CONTRACT_ADDRESS || '';
const DEFAULT_TOKEN_DECIMALS = 18;
const BASE_CHAIN_ID = 8453; // Base mainnet
const BASE_CHAIN_ID_HEX = '0x2105'; // Base mainnet hex

// Base Network RPC endpoints
const BASE_RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';

// Base Network Configuration
const BASE_NETWORK = {
  chainId: BASE_CHAIN_ID_HEX,
  chainName: 'Base',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: [BASE_RPC_URL],
  blockExplorerUrls: ['https://basescan.org'],
};

// ABI для ERC20 токена
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function transfer(address to, uint256 amount) returns (bool)',
];

// ABI для контракта продажи Mrs Crypto
const TOKEN_SALE_ABI = [
  'function pricePerToken() view returns (uint256)',
  'function buyTokens(uint256 tokenAmount) payable',
  'function costFor(uint256 tokenAmount) view returns (uint256)',
  'function availableTokens() view returns (uint256)',
];

let cachedFarcasterProvider: ethers.BrowserProvider | null = null;

async function ensureMiniAppProvider(): Promise<ethers.BrowserProvider | null> {
  if (cachedFarcasterProvider) {
    return cachedFarcasterProvider;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const { getEthereumProvider } = await import('@farcaster/miniapp-sdk/dist/ethereumProvider');
    const miniProvider = await getEthereumProvider();

    if (!miniProvider) {
      return null;
    }

    cachedFarcasterProvider = new ethers.BrowserProvider(miniProvider as any);
    (window as any).ethereum = miniProvider;
    return cachedFarcasterProvider;
  } catch (error) {
    console.warn('⚠️ Farcaster mini app provider not available:', (error as Error)?.message || error);
    return null;
  }
}

// Получить провайдер Farcaster Wallet
export async function getProvider(): Promise<ethers.BrowserProvider | null> {
  return await ensureMiniAppProvider();
}

// Получить провайдер для Base (с RPC fallback)
export function getBaseProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(BASE_RPC_URL);
}

// Переключить сеть на Base
export async function switchToBaseNetwork(): Promise<boolean> {
  try {
    await ensureMiniAppProvider();

    if (typeof window === 'undefined' || !(window as any).ethereum) {
      throw new Error('MetaMask не установлен');
    }

    const ethereum = (window as any).ethereum;

    try {
      // Пытаемся переключиться на Base
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_CHAIN_ID_HEX }],
      });
      return true;
    } catch (switchError: any) {
      // Если сеть не добавлена, добавляем её
      if (switchError.code === 4902 || switchError.code === -32603) {
        try {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [BASE_NETWORK],
          });
          return true;
        } catch (addError) {
          console.error('Error adding Base network:', addError);
          throw new Error('Не удалось добавить сеть Base. Пожалуйста, добавьте её вручную в MetaMask.');
        }
      }
      throw switchError;
    }
  } catch (error: any) {
    console.error('Error switching to Base network:', error);
    throw new Error(error.message || 'Ошибка при переключении на сеть Base');
  }
}

// Проверить, подключена ли сеть Base
export async function isBaseNetwork(): Promise<boolean> {
  try {
    const provider = await getProvider();
    if (!provider) return false;

    const network = await provider.getNetwork();
    return Number(network.chainId) === BASE_CHAIN_ID;
  } catch (error) {
    console.error('Error checking network:', error);
    return false;
  }
}

// Подключить кошелек
export async function connectWallet(): Promise<string | null> {
  try {
    if (typeof window === 'undefined') {
      throw new Error('Window is not available');
    }

    const provider = await ensureMiniAppProvider();

    if (!provider) {
      if ((window as any).web3) {
        throw new Error('Обнаружен старый Web3 провайдер. Пожалуйста, используйте Farcaster Wallet.');
      }

      throw new Error('Farcaster Wallet недоступен. Откройте приложение через Farcaster Mini App.');
    }

    console.log('🔄 Requesting Farcaster wallet connection...');

    try {
      const accounts = await provider.send('eth_requestAccounts', []);

      if (!accounts || accounts.length === 0) {
        throw new Error('Пользователь отменил подключение кошелька');
      }

      console.log('✅ Wallet connected via Farcaster provider:', accounts[0]);
      return accounts[0];
    } catch (requestError: any) {
      if (requestError.code === 4001) {
        throw new Error('Пользователь отменил подключение кошелька');
      } else if (requestError.code === -32002) {
        throw new Error('Запрос на подключение уже обрабатывается. Проверьте Farcaster Wallet.');
      } else {
        throw new Error(requestError.message || 'Ошибка при запросе подключения кошелька');
      }
    }
  } catch (error: any) {
    console.error('❌ Error connecting wallet:', error);
    throw error; // Пробрасываем ошибку дальше, чтобы показать пользователю
  }
}

// Получить баланс кошелька
export async function getBalance(address: string): Promise<string> {
  try {
    const provider = await getProvider();
    if (!provider) return '0';

    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
  } catch (error) {
    console.error('Error getting balance:', error);
    return '0';
  }
}

// Купить токен $MCT через Base
export async function buyToken(): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
}> {
  try {
    const provider = await getProvider();
    if (!provider) {
      throw new Error('Farcaster Wallet не найден. Откройте приложение в Farcaster Mini App.');
    }

    if (!TOKEN_SALE_CONTRACT_ADDRESS) {
      throw new Error('Адрес смарт-контракта продажи не настроен. Установите NEXT_PUBLIC_TOKEN_SALE_CONTRACT_ADDRESS.');
    }

    // Проверить и переключить на Base сеть
    const isBase = await isBaseNetwork();
    if (!isBase) {
      await switchToBaseNetwork();
      // Подождать немного для переключения сети
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const signer = await provider.getSigner();

    const tokenContract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, ERC20_ABI, signer);
    const saleContract = new ethers.Contract(TOKEN_SALE_CONTRACT_ADDRESS, TOKEN_SALE_ABI, signer);

    const decimals: number = await tokenContract.decimals().catch(() => DEFAULT_TOKEN_DECIMALS);
    const tokenAmount = ethers.parseUnits('1', decimals);
    const pricePerToken: bigint = await saleContract.pricePerToken();
    const unit = BigInt(10) ** BigInt(decimals);
    const cost: bigint = (pricePerToken * tokenAmount) / unit;

    if (cost <= 0n) {
      throw new Error('Цена покупки возвращает ноль. Проверьте контракт продажи.');
    }

    const tx = await saleContract.buyTokens(tokenAmount, {
      value: cost,
      gasLimit: 350000,
    });

    console.log('Transaction sent:', tx.hash);
    
    // Дождаться подтверждения транзакции
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      return {
        success: true,
        txHash: tx.hash,
      };
    } else {
      throw new Error('Транзакция не была подтверждена');
    }
  } catch (error: any) {
    console.error('Error buying token:', error);
    
    // Обработка специфических ошибок
    let errorMessage = 'Ошибка при покупке токена';
    
    if (error.message?.includes('user rejected')) {
      errorMessage = 'Транзакция отменена пользователем';
    } else if (error.message?.includes('insufficient funds')) {
      errorMessage = 'Недостаточно средств для покупки. Убедитесь, что у вас есть ETH для оплаты покупки и комиссий сети.';
    } else if (error.message?.includes('network')) {
      errorMessage = 'Ошибка сети. Убедитесь, что вы подключены к сети Base.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// Проверить баланс токена $MCT
export async function checkTokenBalance(address: string): Promise<string> {
  try {
    // Используем Base RPC для проверки баланса, если основной провайдер не доступен
    let provider: ethers.Provider | null = await getProvider();
    if (!provider) {
      provider = getBaseProvider();
    }
    
    const contract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, ERC20_ABI, provider);
    const balance = await contract.balanceOf(address);
    const decimals = await contract.decimals().catch(() => DEFAULT_TOKEN_DECIMALS);
    
    return ethers.formatUnits(balance, decimals);
  } catch (error) {
    console.error('Error checking token balance:', error);
    return '0';
  }
}

// Получить информацию о токене $MCT
export async function getTokenInfo(): Promise<{
  name: string;
  symbol: string;
  address: string;
  decimals: number;
}> {
  try {
    // Используем Base RPC для получения информации о токене
    const farcasterProvider = await getProvider();
    const provider: ethers.Provider = farcasterProvider || getBaseProvider();

    const contract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, ERC20_ABI, provider);
    
    const [name, symbol, decimals] = await Promise.all([
      contract.name().catch(() => 'Mrs Crypto'),
      contract.symbol().catch(() => 'MCT'),
      contract.decimals().catch(() => DEFAULT_TOKEN_DECIMALS)
    ]);

    return {
      name: name || 'Mrs Crypto',
      symbol: symbol || 'MCT',
      address: TOKEN_CONTRACT_ADDRESS,
      decimals: Number(decimals)
    };
  } catch (error: any) {
    console.error('Error getting token info:', error);
    return {
      name: 'Mrs Crypto',
      symbol: 'MCT',
      address: TOKEN_CONTRACT_ADDRESS,
      decimals: DEFAULT_TOKEN_DECIMALS
    };
  }
}

export async function getTokenSalePriceEth(): Promise<string | null> {
  if (!TOKEN_SALE_CONTRACT_ADDRESS) {
    return null;
  }

  try {
    const farcasterProvider = await getProvider();
    const provider: ethers.Provider = farcasterProvider || getBaseProvider();
    const saleContract = new ethers.Contract(TOKEN_SALE_CONTRACT_ADDRESS, TOKEN_SALE_ABI, provider);
    const priceWei: bigint = await saleContract.pricePerToken();
    return ethers.formatEther(priceWei);
  } catch (error) {
    console.error('Error getting token sale price:', error);
    return null;
  }
}

export async function getTokenSaleAvailability(decimals: number = DEFAULT_TOKEN_DECIMALS): Promise<string | null> {
  if (!TOKEN_SALE_CONTRACT_ADDRESS) {
    return null;
  }

  try {
    const farcasterProvider = await getProvider();
    const provider: ethers.Provider = farcasterProvider || getBaseProvider();
    const saleContract = new ethers.Contract(TOKEN_SALE_CONTRACT_ADDRESS, TOKEN_SALE_ABI, provider);
    const available: bigint = await saleContract.availableTokens();
    return ethers.formatUnits(available, decimals);
  } catch (error) {
    console.error('Error getting token sale availability:', error);
    return null;
  }
}

// Проверить транзакцию
export async function verifyTransaction(txHash: string): Promise<boolean> {
  try {
    const provider = await getProvider();
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
    const provider = await getProvider();
    if (!provider) {
      return null;
    }

    const signer = await provider.getSigner();
    return await signer.getAddress();
  } catch (error) {
    console.error('Error getting wallet address:', error);
    return null;
  }
}

