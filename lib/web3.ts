// Web3 функции для покупки токена Миссис Крипто через Base
import { ethers } from 'ethers';

const TOKEN_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS || '0x04D388DA70C32FC5876981097c536c51c8d3D236';
const TOKEN_PRICE_USD = parseFloat(process.env.NEXT_PUBLIC_TOKEN_PRICE_USD || '0.1');
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

// ABI для покупки токена через смарт-контракт (может быть swap или buy функция)
const BUY_CONTRACT_ABI = [
  'function buy() payable',
  'function buyTokens(uint256 amount) payable',
  'function swap() payable',
  'function purchase() payable',
  'function getPrice() view returns (uint256)',
  'function tokenPrice() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'event TokensPurchased(address indexed buyer, uint256 amount, uint256 price)',
];

// Получить провайдер
export function getProvider(): ethers.BrowserProvider | null {
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    return new ethers.BrowserProvider((window as any).ethereum);
  }
  return null;
}

// Получить провайдер для Base (с RPC fallback)
export function getBaseProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(BASE_RPC_URL);
}

// Переключить сеть на Base
export async function switchToBaseNetwork(): Promise<boolean> {
  try {
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
    const provider = getProvider();
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

// Получить текущую цену ETH в USD (можно использовать API или оракул)
async function getEthPriceUsd(): Promise<number> {
  try {
    // Здесь можно использовать реальный API, например CoinGecko
    // Для упрощения используем фиксированное значение или можем добавить API
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const data = await response.json();
    return data.ethereum?.usd || 2500; // Fallback цена
  } catch (error) {
    console.error('Error fetching ETH price:', error);
    return 2500; // Fallback цена ETH в USD
  }
}

// Купить токен $MCT через Base
export async function buyToken(): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
}> {
  try {
    const provider = getProvider();
    if (!provider) {
      throw new Error('Провайдер Web3 не найден. Установите MetaMask или другой Web3 кошелек.');
    }

    // Проверить и переключить на Base сеть
    const isBase = await isBaseNetwork();
    if (!isBase) {
      await switchToBaseNetwork();
      // Подождать немного для переключения сети
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const signer = await provider.getSigner();
    const address = await signer.getAddress();

    // Получить сумму в ETH для покупки
    const ethPriceUsd = await getEthPriceUsd();
    const ethAmount = TOKEN_PRICE_USD / ethPriceUsd;
    const value = ethers.parseEther(ethAmount.toFixed(18));

    // Получить контракт для покупки
    const contract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, BUY_CONTRACT_ABI, signer);

    // Попробовать разные функции покупки
    let tx;
    let errorMsg = '';
    
    try {
      // Сначала попробуем buy()
      tx = await contract.buy({ value, gasLimit: 300000 });
    } catch (buyError: any) {
      errorMsg = buyError.message || '';
      try {
        // Если buy() не работает, попробуем purchase()
        tx = await contract.purchase({ value, gasLimit: 300000 });
      } catch (purchaseError: any) {
        errorMsg = purchaseError.message || '';
        try {
          // Если purchase() не работает, попробуем swap()
          tx = await contract.swap({ value, gasLimit: 300000 });
        } catch (swapError: any) {
          // Если swap() не работает, попробуем buyTokens с 1 токеном
          try {
            const oneToken = ethers.parseEther('1'); // 1 токен
            tx = await contract.buyTokens(oneToken, { value, gasLimit: 300000 });
          } catch (buyTokensError: any) {
            throw new Error(
              'Смарт-контракт не поддерживает стандартные функции покупки. ' +
              'Пожалуйста, проверьте адрес контракта. ' +
              `Последняя ошибка: ${buyTokensError.message || errorMsg}`
            );
          }
        }
      }
    }
    
    if (!tx) {
      throw new Error('Не удалось создать транзакцию покупки');
    }

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
    let provider: ethers.Provider = getProvider() || getBaseProvider();
    
    const contract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, ERC20_ABI, provider);
    const balance = await contract.balanceOf(address);
    const decimals = await contract.decimals().catch(() => 18);
    
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
    const provider: ethers.Provider = getProvider() || getBaseProvider();

    const contract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, ERC20_ABI, provider);
    
    const [name, symbol, decimals] = await Promise.all([
      contract.name().catch(() => 'Mrs Crypto'),
      contract.symbol().catch(() => 'MCT'),
      contract.decimals().catch(() => 18)
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

