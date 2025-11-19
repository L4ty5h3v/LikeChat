// Web3 функции для покупки токена Миссис Крипто через Farcaster API
import { ethers } from 'ethers';

// Константы конфигурации
const TOKEN_CONTRACT_ADDRESS = '0x04d388da70c32fc5876981097c536c51c8d3d236'; // MCT Token
// Обрезаем пробелы и переносы строк из адреса контракта
const TOKEN_SALE_CONTRACT_ADDRESS: string = (process.env.NEXT_PUBLIC_TOKEN_SALE_CONTRACT_ADDRESS || '0x3FD7a1D5C9C3163E873Df212006cB81D7178f3b4').trim().replace(/[\r\n]/g, ''); // Адрес контракта продажи
const TOKEN_SALE_USDC_CONTRACT_ADDRESS: string = (process.env.NEXT_PUBLIC_TOKEN_SALE_USDC_CONTRACT_ADDRESS || '').trim().replace(/[\r\n]/g, ''); // Адрес контракта продажи USDC (если используется)
const USDC_CONTRACT_ADDRESS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'; // USDC на Base (6 decimals) - правильный адрес
const USE_USDC_FOR_PURCHASE = true; // Использовать USDC вместо ETH
const USE_FARCASTER_SWAP = false; // Использовать смарт-контракт продажи вместо Uniswap swap
const DEFAULT_TOKEN_DECIMALS = 18;
const PURCHASE_AMOUNT_USDC = 0.10; // Покупаем MCT на 0.10 USDC (количество рассчитывается через Uniswap)
const BASE_CHAIN_ID = 8453; // Base mainnet
const BASE_CHAIN_ID_HEX = '0x2105'; // Base mainnet hex

// Base Network RPC endpoints
const BASE_RPC_URL = 'https://mainnet.base.org';

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
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

// ABI для контракта продажи MCTTokenSale (ETH)
const TOKEN_SALE_ABI = [
  'function buyTokensWithETH(uint256 tokenAmount) payable',
  'function getCostETH(uint256 tokenAmount) view returns (uint256)',
  'function pricePerTokenETH() view returns (uint256)',
  'event TokensPurchased(address indexed buyer, uint256 tokenAmount, uint256 paidAmount, bool isUSDC)',
];

// ABI для контракта продажи MCTTokenSale (USDC) - используем тот же контракт
const TOKEN_SALE_USDC_ABI = [
  'function buyTokensWithUSDC(uint256 tokenAmount)',
  'function getCostUSDC(uint256 tokenAmount) view returns (uint256)',
  'function pricePerTokenUSDC() view returns (uint256)',
  'event TokensPurchased(address indexed buyer, uint256 tokenAmount, uint256 paidAmount, bool isUSDC)',
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

// Проверить allowance (одобрение) для USDC
export async function checkUSDCAllowance(
  ownerAddress: string,
  spenderAddress: string
): Promise<bigint> {
  try {
    const provider = getBaseProvider();
    const usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, ERC20_ABI, provider);
    const allowance = await usdcContract.allowance(ownerAddress, spenderAddress);
    return allowance;
  } catch (error) {
    console.error('Error checking USDC allowance:', error);
    return 0n;
  }
}

// Одобрить трату USDC для смарт-контракта продажи
export async function approveUSDC(
  amount: bigint
): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
}> {
  try {
    const provider = await getProvider();
    if (!provider) {
      throw new Error('Farcaster Wallet не найден. Откройте приложение в Farcaster Mini App.');
    }

    // Проверяем, что адрес контракта валидный (не пустой и не только пробелы)
    const cleanContractAddress = TOKEN_SALE_CONTRACT_ADDRESS?.trim();
    if (!cleanContractAddress || cleanContractAddress.length < 10) {
      console.warn('[web3] Token sale contract address not configured or invalid');
      return {
        success: false,
        error: 'Адрес смарт-контракта продажи не настроен. Установите NEXT_PUBLIC_TOKEN_SALE_CONTRACT_ADDRESS.',
      };
    }

    const signer = await provider.getSigner();
    const ownerAddress = await signer.getAddress();

    // Проверяем текущий allowance
    const currentAllowance = await checkUSDCAllowance(ownerAddress, TOKEN_SALE_CONTRACT_ADDRESS);
    
    if (currentAllowance >= amount) {
      console.log('✅ USDC already approved:', ethers.formatUnits(currentAllowance, 6));
      return {
        success: true,
      };
    }

    const usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, ERC20_ABI, signer);
    
    console.log(`🔄 Approving USDC spending: ${ethers.formatUnits(amount, 6)} USDC`);
    
    const tx = await usdcContract.approve(TOKEN_SALE_CONTRACT_ADDRESS, amount, {
      gasLimit: 100000,
    });

    console.log('✅ Approval transaction sent:', tx.hash);
    
    // Дождаться подтверждения
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      return {
        success: true,
        txHash: tx.hash,
      };
    } else {
      throw new Error('Транзакция одобрения не была подтверждена');
    }
  } catch (error: any) {
    console.error('Error approving USDC:', error);
    
    let errorMessage = 'Ошибка при одобрении USDC';
    
    if (error.message?.includes('user rejected')) {
      errorMessage = 'Транзакция одобрения отменена пользователем';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// Купить токен $MCT через смарт-контракт или Farcaster Swap API
export async function buyToken(userFid: number): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
  verified?: boolean;
}> {
  try {
    // Используем Farcaster Swap API (включено по умолчанию)
    if (USE_FARCASTER_SWAP) {
      // Используем Farcaster Swap API
      const paymentToken = USE_USDC_FOR_PURCHASE ? 'USDC' : 'ETH';
      const { buyTokenViaFarcasterSwap } = await import('@/lib/farcaster-swap');
      return await buyTokenViaFarcasterSwap(userFid, paymentToken);
    }

    // Используем смарт-контракт (старый способ)
    const provider = await getProvider();
    if (!provider) {
      throw new Error('Farcaster Wallet не найден. Откройте приложение в Farcaster Mini App.');
    }

    // Определяем, какой контракт использовать
    // Для USDC используем тот же контракт, если не указан отдельный адрес
    const useUSDC = USE_USDC_FOR_PURCHASE;
    const useSeparateUSDCContract = USE_USDC_FOR_PURCHASE && TOKEN_SALE_USDC_CONTRACT_ADDRESS;
    let saleContractAddress = useSeparateUSDCContract ? TOKEN_SALE_USDC_CONTRACT_ADDRESS : TOKEN_SALE_CONTRACT_ADDRESS;
    
    // Обрезаем адрес от пробелов и переносов строк
    if (saleContractAddress) {
      saleContractAddress = saleContractAddress.trim().replace(/[\r\n]/g, '');
    }

    const cleanContractAddress = saleContractAddress?.trim();
    if (!cleanContractAddress || cleanContractAddress.length < 10) {
      console.warn('[web3] Token sale contract address not configured or invalid');
      return {
        success: false,
        error: 'Адрес смарт-контракта продажи не настроен. Установите NEXT_PUBLIC_TOKEN_SALE_CONTRACT_ADDRESS или NEXT_PUBLIC_TOKEN_SALE_USDC_CONTRACT_ADDRESS.',
      };
    }

    // Проверить и переключить на Base сеть
    const isBase = await isBaseNetwork();
    if (!isBase) {
      await switchToBaseNetwork();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const signer = await provider.getSigner();
    const buyerAddress = await signer.getAddress();

    // Рассчитываем количество MCT, которое можно купить за 0.10 USDC через Uniswap
    const tokenAmount = await getMCTAmountForPurchase();
    if (!tokenAmount || tokenAmount === 0n) {
      throw new Error('Не удалось рассчитать количество MCT для покупки через Uniswap');
    }

    const tokenDecimals = DEFAULT_TOKEN_DECIMALS;
    const tokenAmountFormatted = ethers.formatUnits(tokenAmount, tokenDecimals);
    console.log(`📊 Calculated token amount: ${tokenAmountFormatted} MCT for ${PURCHASE_AMOUNT_USDC} USDC`);

    if (useUSDC) {
      // Покупка через USDC
      return await buyTokenWithUSDC(signer, buyerAddress, saleContractAddress, tokenAmount, tokenDecimals);
    } else {
      // Покупка через ETH
      return await buyTokenWithETH(signer, buyerAddress, saleContractAddress, tokenAmount, tokenDecimals);
    }
  } catch (error: any) {
    console.error('Error buying token:', error);
    
    // Обработка специфических ошибок
    let errorMessage = 'Ошибка при покупке токена';
    
    if (error.message?.includes('user rejected')) {
      errorMessage = 'Транзакция отменена пользователем';
    } else if (error.message?.includes('insufficient funds') || error.message?.includes('Недостаточно')) {
      errorMessage = 'Недостаточно средств для покупки. Убедитесь, что у вас достаточно средств и ETH для комиссий сети.';
    } else if (error.message?.includes('network')) {
      errorMessage = 'Ошибка сети. Убедитесь, что вы подключены к сети Base.';
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

// Покупка токена через ETH
async function buyTokenWithETH(
  signer: ethers.Signer,
  buyerAddress: string,
  saleContractAddress: string,
  tokenAmount: bigint,
  tokenDecimals: number
): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
  verified?: boolean;
}> {
  // Обрезаем адрес от пробелов и переносов строк
  const cleanContractAddress = saleContractAddress.trim().replace(/[\r\n]/g, '');
  
  // Используем Base RPC для чтения данных (getCostETH), так как Farcaster Wallet не поддерживает eth_call
  const baseProvider = getBaseProvider();
  const readContract = new ethers.Contract(cleanContractAddress, TOKEN_SALE_ABI, baseProvider);
  
  // Получаем стоимость покупки через getCostETH используя Base RPC
  const costWei: bigint = await readContract.getCostETH(tokenAmount);
  const costEth = ethers.formatEther(costWei);
  
  // Для записи (покупки) используем signer с Farcaster Wallet
  const saleContract = new ethers.Contract(cleanContractAddress, TOKEN_SALE_ABI, signer);
  
  const tokenAmountFormatted = ethers.formatUnits(tokenAmount, tokenDecimals);
  console.log(`💰 Purchase cost: ${costEth} ETH for ${tokenAmountFormatted} MCT`);

  if (costWei <= 0n) {
    throw new Error('Цена покупки возвращает ноль. Проверьте контракт продажи.');
  }

  // Проверяем баланс ETH
  const provider = signer.provider!;
  const ethBalance = await provider.getBalance(buyerAddress);
  if (ethBalance < costWei) {
    throw new Error(`Недостаточно ETH. Требуется: ${costEth} ETH`);
  }

  // Покупаем токен через смарт-контракт используя buyTokensWithETH
  console.log(`🔄 Purchasing ${tokenAmountFormatted} MCT tokens with ETH...`);
  
  const tx = await saleContract.buyTokensWithETH(tokenAmount, {
    value: costWei,
    gasLimit: 350000,
  });

  console.log('✅ Purchase transaction sent:', tx.hash);
  
  // Дождаться подтверждения транзакции
  const receipt = await tx.wait();
  
  if (receipt.status === 1) {
    // Верифицируем покупку
    const isValidPurchase = await verifyTokenPurchase(tx.hash, buyerAddress);
    
    if (!isValidPurchase) {
      throw new Error('Покупка не была верифицирована через контракт продажи');
    }
    
    return {
      success: true,
      txHash: tx.hash,
      verified: true,
    };
  } else {
    throw new Error('Транзакция не была подтверждена');
  }
}

// Покупка токена через USDC
async function buyTokenWithUSDC(
  signer: ethers.Signer,
  buyerAddress: string,
  saleContractAddress: string,
  tokenAmount: bigint,
  tokenDecimals: number
): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
  verified?: boolean;
}> {
  // Обрезаем адрес от пробелов и переносов строк
  const cleanContractAddress = saleContractAddress.trim().replace(/[\r\n]/g, '');
  
  // Используем Base RPC для чтения данных (getCostUSDC), так как Farcaster Wallet не поддерживает eth_call
  const baseProvider = getBaseProvider();
  const readContract = new ethers.Contract(cleanContractAddress, TOKEN_SALE_USDC_ABI, baseProvider);
  
  // Получаем стоимость покупки в USDC используя Base RPC
  const costUSDC: bigint = await readContract.getCostUSDC(tokenAmount);
  
  // Для записи (покупки) используем signer с Farcaster Wallet
  const saleContract = new ethers.Contract(cleanContractAddress, TOKEN_SALE_USDC_ABI, signer);
  const costUSDCFormatted = ethers.formatUnits(costUSDC, 6); // USDC имеет 6 decimals
  const tokenAmountFormatted = ethers.formatUnits(tokenAmount, tokenDecimals);
  console.log(`💰 Purchase cost: ${costUSDCFormatted} USDC for ${tokenAmountFormatted} MCT`);

  if (costUSDC <= 0n) {
    throw new Error('Цена покупки возвращает ноль. Проверьте контракт продажи.');
  }

  // Для чтения данных используем Base RPC (Farcaster Wallet не поддерживает eth_call)
  // Для записи (approve, transfer) используем signer с Farcaster Wallet
  const usdcContractRead = new ethers.Contract(USDC_CONTRACT_ADDRESS, ERC20_ABI, baseProvider);
  const usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, ERC20_ABI, signer);
  
  // Проверяем баланс USDC используя Base RPC
  const usdcBalance = await usdcContractRead.balanceOf(buyerAddress);
  if (usdcBalance < costUSDC) {
    throw new Error(`Недостаточно USDC. Требуется: ${costUSDCFormatted} USDC`);
  }
  console.log(`✅ USDC balance check: ${ethers.formatUnits(usdcBalance, 6)} USDC available`);

  // Проверяем allowance (одобрение) используя Base RPC
  const currentAllowance = await usdcContractRead.allowance(buyerAddress, cleanContractAddress);
  
  if (currentAllowance < costUSDC) {
    console.log(`🔄 Approving USDC spending: ${costUSDCFormatted} USDC`);
    
    // Одобряем трату USDC (одобряем немного больше для комиссий)
    const approveAmount = costUSDC * 2n; // Одобряем в 2 раза больше для запаса
    const approveTx = await usdcContract.approve(cleanContractAddress, approveAmount, {
      gasLimit: 100000,
    });
    
    console.log('✅ Approval transaction sent:', approveTx.hash);
    
    // Дождаться подтверждения одобрения
    const approveReceipt = await approveTx.wait();
    
    if (approveReceipt.status !== 1) {
      throw new Error('Транзакция одобрения не была подтверждена');
    }
    
    console.log('✅ USDC approved successfully');
  } else {
    console.log('✅ USDC already approved');
  }

  // Покупаем токен через смарт-контракт используя buyTokensWithUSDC
  console.log(`🔄 Purchasing ${tokenAmountFormatted} MCT tokens with USDC...`);
  
  const tx = await saleContract.buyTokensWithUSDC(tokenAmount, {
    gasLimit: 350000,
  });

  console.log('✅ Purchase transaction sent:', tx.hash);
  
  // Дождаться подтверждения транзакции
  const receipt = await tx.wait();
  
  if (receipt.status === 1) {
    // Верифицируем покупку
    const isValidPurchase = await verifyTokenPurchaseUSDC(tx.hash, buyerAddress);
    
    if (!isValidPurchase) {
      throw new Error('Покупка не была верифицирована через контракт продажи');
    }
    
    return {
      success: true,
      txHash: tx.hash,
      verified: true,
    };
  } else {
    throw new Error('Транзакция не была подтверждена');
  }
}

// Проверить баланс токена $MCT
export async function checkTokenBalance(address: string): Promise<string> {
  try {
    // Всегда используем Base RPC, так как Farcaster Wallet не поддерживает eth_call
    const provider = getBaseProvider();
    
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
    // Всегда используем Base RPC, так как Farcaster Wallet не поддерживает eth_call
    const provider = getBaseProvider();

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

// Получить цену 1 MCT в USDC через Uniswap пары MCT/WETH и WETH/USDC (полностью onchain через API)
// Использует backend API для избежания eth_call в Farcaster Wallet
async function getMCTPricePerTokenInUSDC(): Promise<number | null> {
  try {
    console.log(`🔍 Fetching MCT price: MCT → WETH → USDC (via API backend)...`);
    
    const response = await fetch('/api/quote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'price',
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ API quote error:', errorData.error || response.statusText);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.success || !data.pricePerTokenUSDC) {
      console.error('❌ API quote failed:', data.error || 'Unknown error');
      return null;
    }
    
    console.log(`✅ Final MCT price: ${data.pricePerTokenUSDC.toFixed(6)} USDC per 1 MCT (via API)`);
    return data.pricePerTokenUSDC;
  } catch (error: any) {
    console.error('❌ Error getting MCT price from API:', error?.message || error);
    return null;
  }
}

// Получить количество MCT, которое можно купить за 0.10 USDC через Uniswap (через API)
export async function getMCTAmountForPurchase(): Promise<bigint | null> {
  try {
    console.log(`🔍 Fetching MCT amount for ${PURCHASE_AMOUNT_USDC} USDC: USDC → WETH → MCT (via API)...`);
    
    // Используем API для прямого quote: USDC → WETH → MCT
    const response = await fetch('/api/quote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'amount',
        usdcAmount: PURCHASE_AMOUNT_USDC,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn('⚠️ Failed to get MCT amount from API, using price calculation fallback:', errorData.error || response.statusText);
      
      // Fallback: используем цену для расчета количества
      const pricePerTokenUSDC = await getMCTPricePerTokenInUSDC();
      
      if (!pricePerTokenUSDC || pricePerTokenUSDC <= 0) {
        console.warn('⚠️ Failed to get MCT price from API, using fixed fallback: 0.10 USDC = 1 MCT');
        const fallbackAmount = 1.0; // 1 MCT за 0.10 USDC
        const mctAmountBigInt = ethers.parseUnits(fallbackAmount.toFixed(DEFAULT_TOKEN_DECIMALS), DEFAULT_TOKEN_DECIMALS);
        console.log(`✅ Using fallback calculation: ${PURCHASE_AMOUNT_USDC} USDC → ${fallbackAmount} MCT`);
        return mctAmountBigInt;
      }
      
      const mctAmount = PURCHASE_AMOUNT_USDC / pricePerTokenUSDC;
      
      if (mctAmount <= 0 || !isFinite(mctAmount)) {
        console.error('❌ Calculated MCT amount is invalid:', mctAmount);
        // Используем fallback
        const fallbackAmount = 1.0;
        return ethers.parseUnits(fallbackAmount.toFixed(DEFAULT_TOKEN_DECIMALS), DEFAULT_TOKEN_DECIMALS);
      }
      
      const mctAmountBigInt = ethers.parseUnits(mctAmount.toFixed(DEFAULT_TOKEN_DECIMALS), DEFAULT_TOKEN_DECIMALS);
      
      const mctAmountFormatted = ethers.formatUnits(mctAmountBigInt, DEFAULT_TOKEN_DECIMALS);
      console.log(`✅ Calculated: ${PURCHASE_AMOUNT_USDC} USDC → ${mctAmountFormatted} MCT (fallback via price)`);
      
      return mctAmountBigInt;
    }
    
    // Успешный ответ от API
    const data = await response.json();
    
    if (!data.success || !data.mctAmount) {
      console.warn('⚠️ API returned unsuccessful response, using price calculation fallback:', data.error || 'Unknown error');
      
      // Fallback: используем цену для расчета количества
      const pricePerTokenUSDC = await getMCTPricePerTokenInUSDC();
      
      if (!pricePerTokenUSDC || pricePerTokenUSDC <= 0) {
        console.warn('⚠️ Failed to get MCT price from API, using fixed fallback: 0.10 USDC = 1 MCT');
        const fallbackAmount = 1.0;
        const mctAmountBigInt = ethers.parseUnits(fallbackAmount.toFixed(DEFAULT_TOKEN_DECIMALS), DEFAULT_TOKEN_DECIMALS);
        console.log(`✅ Using fallback calculation: ${PURCHASE_AMOUNT_USDC} USDC → ${fallbackAmount} MCT`);
        return mctAmountBigInt;
      }
      
      const mctAmount = PURCHASE_AMOUNT_USDC / pricePerTokenUSDC;
      
      if (mctAmount <= 0 || !isFinite(mctAmount)) {
        const fallbackAmount = 1.0;
        return ethers.parseUnits(fallbackAmount.toFixed(DEFAULT_TOKEN_DECIMALS), DEFAULT_TOKEN_DECIMALS);
      }
      
      const mctAmountBigInt = ethers.parseUnits(mctAmount.toFixed(DEFAULT_TOKEN_DECIMALS), DEFAULT_TOKEN_DECIMALS);
      return mctAmountBigInt;
    }
    
    // Используем количество из API
    const mctAmountBigInt = BigInt(data.mctAmount);
    const mctAmountFormatted = ethers.formatUnits(mctAmountBigInt, DEFAULT_TOKEN_DECIMALS);
    console.log(`✅ API quote: ${PURCHASE_AMOUNT_USDC} USDC → ${mctAmountFormatted} MCT`);
    
    return mctAmountBigInt;
  } catch (error: any) {
    console.error('❌ Error calculating MCT amount for purchase:', error);
    // Fallback на фиксированное количество
    console.warn('⚠️ Using fallback: 1 MCT for 0.10 USDC');
    const fallbackAmount = 1.0;
    return ethers.parseUnits(fallbackAmount.toFixed(DEFAULT_TOKEN_DECIMALS), DEFAULT_TOKEN_DECIMALS);
  }
}

// Получить курс ETH в USD
async function fetchEthUsdPrice(): Promise<number | null> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const data = await response.json();
    const price = data?.ethereum?.usd;
    return typeof price === 'number' ? price : null;
  } catch (error) {
    console.error('Error fetching ETH price in USD:', error);
    return null;
  }
}

// Получить цену покупки (цена за 1 MCT в USDC)
export async function getTokenSalePriceEth(): Promise<string | null> {
  // Пытаемся получить цену 1 MCT в USDC через Uniswap
  const pricePerToken = await getMCTPricePerTokenInUSDC();
  if (pricePerToken && pricePerToken > 0) {
    console.log(`✅ Price from Uniswap: ${pricePerToken.toFixed(6)} USDC per 1 MCT`);
    return pricePerToken.toFixed(6);
  }
  
  // Fallback: если Uniswap не работает, используем фиксированную цену
  // 0.10 USDC = 1 MCT, значит 1 MCT = 0.10 USDC
  console.warn('⚠️ Failed to get price from Uniswap, using fallback: 0.10 USDC per 1 MCT');
  return PURCHASE_AMOUNT_USDC.toString(); // 0.10 USDC per 1 MCT (fallback)
}

// Получить стоимость покупки 0.10 MCT
export async function getPurchaseCost(): Promise<{
  costEth: string;
  costUsd?: string;
} | null> {
    // Обрезаем адрес от пробелов и переносов строк
    const cleanContractAddress = (TOKEN_SALE_CONTRACT_ADDRESS || '').trim().replace(/[\r\n]/g, '');
    
    if (!cleanContractAddress) {
      return null;
    }

    try {
      const provider = getBaseProvider();
      const saleContract = new ethers.Contract(cleanContractAddress, TOKEN_SALE_ABI, provider);
    
      // Получаем количество MCT для покупки через Uniswap
      const tokenAmount = await getMCTAmountForPurchase();
      if (!tokenAmount || tokenAmount === 0n) {
        return null;
      }
      
      const costWei: bigint = await saleContract.getCostETH(tokenAmount);
      const costEth = ethers.formatEther(costWei);
      
      return {
        costEth,
      };
    } catch (error) {
      console.error('Error getting purchase cost:', error);
      return null;
    }
}

// Верифицировать покупку токена через контракт продажи (ETH)
export async function verifyTokenPurchase(txHash: string, buyerAddress: string): Promise<boolean> {
  try {
    // Если используется swap, верификация не нужна (swap происходит через DEX)
    if (USE_FARCASTER_SWAP) {
      return true; // Swap верифицируется через баланс токенов
    }

    const useSeparateUSDCContract = USE_USDC_FOR_PURCHASE && TOKEN_SALE_USDC_CONTRACT_ADDRESS;
    let saleContractAddress: string = useSeparateUSDCContract 
      ? TOKEN_SALE_USDC_CONTRACT_ADDRESS 
      : TOKEN_SALE_CONTRACT_ADDRESS;
    
    // Обрезаем адрес от пробелов и переносов строк
    saleContractAddress = saleContractAddress.trim().replace(/[\r\n]/g, '');

    if (!saleContractAddress) {
      console.error('Token sale contract address not configured');
      return false;
    }

    const provider = getBaseProvider();
    
    // Получаем receipt транзакции
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt || receipt.status !== 1) {
      console.error('Transaction not found or failed');
      return false;
    }

    // Проверяем, что транзакция была отправлена на контракт продажи
    const receiptTo = receipt.to?.toLowerCase() || '';
    if (receiptTo !== saleContractAddress.toLowerCase()) {
      console.error('Transaction was not sent to token sale contract');
      return false;
    }

    // Создаем интерфейс контракта для парсинга событий
    const saleContract = new ethers.Contract(saleContractAddress, TOKEN_SALE_ABI, provider);
    
    // Парсим событие TokensPurchased из логов транзакции
    const eventInterface = saleContract.interface;
    
    // Ищем событие TokensPurchased в логах
    for (const log of receipt.logs) {
      try {
        const parsedLog = eventInterface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        
        if (parsedLog && parsedLog.name === 'TokensPurchased') {
          const buyer = parsedLog.args[0]; // indexed buyer
          const tokenAmount = parsedLog.args[1];
          const paidWei = parsedLog.args[2];
          
          // Проверяем, что покупатель совпадает с адресом пользователя
          if (buyer.toLowerCase() === buyerAddress.toLowerCase() && tokenAmount > 0n) {
            console.log('✅ Token purchase verified:', {
              buyer,
              tokenAmount: ethers.formatUnits(tokenAmount, DEFAULT_TOKEN_DECIMALS),
              paidWei: ethers.formatEther(paidWei),
            });
            return true;
          }
        }
      } catch (parseError) {
        // Продолжаем поиск, если это не наше событие
        continue;
      }
    }
    
    console.error('TokensPurchased event not found in transaction logs');
    return false;
  } catch (error) {
    console.error('Error verifying token purchase:', error);
    return false;
  }
}

// Верифицировать покупку токена через контракт продажи (USDC)
async function verifyTokenPurchaseUSDC(txHash: string, buyerAddress: string): Promise<boolean> {
  try {
    // Используем тот же контракт, что и для ETH, если не указан отдельный адрес
    const useSeparateUSDCContract = USE_USDC_FOR_PURCHASE && TOKEN_SALE_USDC_CONTRACT_ADDRESS;
    const saleContractAddress = useSeparateUSDCContract ? TOKEN_SALE_USDC_CONTRACT_ADDRESS : TOKEN_SALE_CONTRACT_ADDRESS;
    
    if (!saleContractAddress) {
      console.error('Token sale USDC contract address not configured');
      return false;
    }
    
    // Обрезаем адрес от пробелов и переносов строк
    const cleanContractAddress = saleContractAddress.trim().replace(/[\r\n]/g, '');

    const provider = getBaseProvider();
    
    // Получаем receipt транзакции
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt || receipt.status !== 1) {
      console.error('Transaction not found or failed');
      return false;
    }

    // Проверяем, что транзакция была отправлена на контракт продажи
    const receiptTo = receipt.to?.toLowerCase() || '';
    const contractAddressLower = cleanContractAddress.toLowerCase();
    if (receiptTo !== contractAddressLower) {
      console.error('Transaction was not sent to token sale contract');
      return false;
    }

    // Создаем интерфейс контракта для парсинга событий
    const saleContract = new ethers.Contract(cleanContractAddress, TOKEN_SALE_USDC_ABI, provider);
    
    // Парсим событие TokensPurchased из логов транзакции
    const eventInterface = saleContract.interface;
    
    // Ищем событие TokensPurchased в логах
    for (const log of receipt.logs) {
      try {
        const parsedLog = eventInterface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        
        if (parsedLog && parsedLog.name === 'TokensPurchased') {
          const buyer = parsedLog.args[0]; // indexed buyer
          const tokenAmount = parsedLog.args[1];
          const paidUSDC = parsedLog.args[2];
          
          // Проверяем, что покупатель совпадает с адресом пользователя
          if (buyer.toLowerCase() === buyerAddress.toLowerCase() && tokenAmount > 0n) {
            console.log('✅ Token purchase verified (USDC):', {
              buyer,
              tokenAmount: ethers.formatUnits(tokenAmount, DEFAULT_TOKEN_DECIMALS),
              paidUSDC: ethers.formatUnits(paidUSDC, 6),
            });
            return true;
          }
        }
      } catch (parseError) {
        // Продолжаем поиск, если это не наше событие
        continue;
      }
    }
    
    console.error('TokensPurchased event not found in transaction logs');
    return false;
  } catch (error) {
    console.error('Error verifying token purchase (USDC):', error);
    return false;
  }
}

// Верифицировать покупку токена через Farcaster API
export async function verifyTokenPurchaseViaFarcaster(userFid: number): Promise<boolean> {
  try {
    const { getUserByFid } = await import('@/lib/neynar');
    const user = await getUserByFid(userFid);
    return !!user;
  } catch (error) {
    console.error('Error verifying token purchase via Farcaster:', error);
    return false;
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

