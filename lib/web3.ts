// Web3 функции для покупки токена Миссис Крипто через Farcaster API
import { ethers } from 'ethers';

// Константы конфигурации (без использования env)
const TOKEN_CONTRACT_ADDRESS = '0x04d388da70c32fc5876981097c536c51c8d3d236'; // MCT Token
const TOKEN_SALE_CONTRACT_ADDRESS: string = ''; // Адрес контракта продажи (если используется)
const TOKEN_SALE_USDC_CONTRACT_ADDRESS: string = ''; // Адрес контракта продажи USDC (если используется)
const USDC_CONTRACT_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC на Base
const USE_USDC_FOR_PURCHASE = false; // Использовать USDC вместо ETH
const USE_FARCASTER_SWAP = true; // Использовать Farcaster Swap API вместо смарт-контракта
const DEFAULT_TOKEN_DECIMALS = 18;
const TOKEN_AMOUNT_TO_BUY = '0.10'; // Покупаем 0.10 MCT
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

// ABI для контракта продажи Mrs Crypto (ETH)
const TOKEN_SALE_ABI = [
  'function pricePerToken() view returns (uint256)',
  'function buyTokens(uint256 tokenAmount) payable',
  'function costFor(uint256 tokenAmount) view returns (uint256)',
  'function availableTokens() view returns (uint256)',
  'event TokensPurchased(address indexed buyer, uint256 tokenAmount, uint256 paidWei)',
];

// ABI для контракта продажи Mrs Crypto (USDC)
const TOKEN_SALE_USDC_ABI = [
  'function pricePerToken() view returns (uint256)',
  'function buyTokens(uint256 tokenAmount)',
  'function costFor(uint256 tokenAmount) view returns (uint256)',
  'function availableTokens() view returns (uint256)',
  'function paymentToken() view returns (address)',
  'event TokensPurchased(address indexed buyer, uint256 tokenAmount, uint256 paidUSDC)',
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

    if (!TOKEN_SALE_CONTRACT_ADDRESS) {
      throw new Error('Адрес смарт-контракта продажи не настроен. Установите NEXT_PUBLIC_TOKEN_SALE_CONTRACT_ADDRESS.');
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
    const useUSDC = USE_USDC_FOR_PURCHASE && TOKEN_SALE_USDC_CONTRACT_ADDRESS;
    const saleContractAddress = useUSDC ? TOKEN_SALE_USDC_CONTRACT_ADDRESS : TOKEN_SALE_CONTRACT_ADDRESS;

    if (!saleContractAddress) {
      throw new Error('Адрес смарт-контракта продажи не настроен. Установите NEXT_PUBLIC_TOKEN_SALE_CONTRACT_ADDRESS или NEXT_PUBLIC_TOKEN_SALE_USDC_CONTRACT_ADDRESS.');
    }

    // Проверить и переключить на Base сеть
    const isBase = await isBaseNetwork();
    if (!isBase) {
      await switchToBaseNetwork();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const signer = await provider.getSigner();
    const buyerAddress = await signer.getAddress();

    // Получаем информацию о токене и контракте продажи
    const tokenContract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, ERC20_ABI, signer);
    const tokenDecimals: number = await tokenContract.decimals().catch(() => DEFAULT_TOKEN_DECIMALS);
    const tokenAmount = ethers.parseUnits(TOKEN_AMOUNT_TO_BUY, tokenDecimals);

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
  const saleContract = new ethers.Contract(saleContractAddress, TOKEN_SALE_ABI, signer);
  
  // Получаем стоимость покупки
  const costWei: bigint = await saleContract.costFor(tokenAmount);
  const costEth = ethers.formatEther(costWei);
  
  console.log(`💰 Purchase cost: ${costEth} ETH for ${TOKEN_AMOUNT_TO_BUY} MCT`);

  if (costWei <= 0n) {
    throw new Error('Цена покупки возвращает ноль. Проверьте контракт продажи.');
  }

  // Проверяем баланс ETH
  const provider = signer.provider!;
  const ethBalance = await provider.getBalance(buyerAddress);
  if (ethBalance < costWei) {
    throw new Error(`Недостаточно ETH. Требуется: ${costEth} ETH`);
  }

  // Покупаем токен через смарт-контракт
  console.log(`🔄 Purchasing ${TOKEN_AMOUNT_TO_BUY} MCT tokens with ETH...`);
  
  const tx = await saleContract.buyTokens(tokenAmount, {
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
  const saleContract = new ethers.Contract(saleContractAddress, TOKEN_SALE_USDC_ABI, signer);
  
  // Получаем стоимость покупки в USDC
  const costUSDC: bigint = await saleContract.costFor(tokenAmount);
  const costUSDCFormatted = ethers.formatUnits(costUSDC, 6); // USDC имеет 6 decimals
  
  console.log(`💰 Purchase cost: ${costUSDCFormatted} USDC for ${TOKEN_AMOUNT_TO_BUY} MCT`);

  if (costUSDC <= 0n) {
    throw new Error('Цена покупки возвращает ноль. Проверьте контракт продажи.');
  }

  // Проверяем баланс USDC
  const usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, ERC20_ABI, signer);
  const usdcBalance = await usdcContract.balanceOf(buyerAddress);
  if (usdcBalance < costUSDC) {
    throw new Error(`Недостаточно USDC. Требуется: ${costUSDCFormatted} USDC`);
  }

  // Проверяем allowance (одобрение)
  const currentAllowance = await usdcContract.allowance(buyerAddress, saleContractAddress);
  
  if (currentAllowance < costUSDC) {
    console.log(`🔄 Approving USDC spending: ${costUSDCFormatted} USDC`);
    
    // Одобряем трату USDC
    const approveTx = await usdcContract.approve(saleContractAddress, costUSDC, {
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

  // Покупаем токен через смарт-контракт
  console.log(`🔄 Purchasing ${TOKEN_AMOUNT_TO_BUY} MCT tokens with USDC...`);
  
  const tx = await saleContract.buyTokens(tokenAmount, {
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

// Получить цену токена (через swap или смарт-контракт)
export async function getTokenSalePriceEth(): Promise<string | null> {
  // Если используется Farcaster Swap, проверяем, используется ли прямой контракт продажи
  if (USE_FARCASTER_SWAP) {
    // Проверяем, используется ли прямой контракт продажи (рекомендуемый способ)
    try {
      const { getPriceFromSaleContract } = await import('@/lib/farcaster-direct-purchase');
      const paymentToken = USE_USDC_FOR_PURCHASE ? 'USDC' : 'ETH';
      const price = await getPriceFromSaleContract(paymentToken);
      if (price) {
        console.log(`💰 Price from sale contract: ${price} ${paymentToken}`);
        return price;
      }
    } catch (error) {
      console.warn('Could not get price from sale contract, using fallback:', error);
    }
    
    // Fallback: примерная цена (если контракт не развернут)
    if (USE_USDC_FOR_PURCHASE) {
      return '0.25'; // 0.25 USDC за 0.10 MCT
    } else {
      return '0.0001'; // 0.0001 ETH за 0.10 MCT
    }
  }

  // Используем смарт-контракт для получения точной цены
  const useUSDC = USE_USDC_FOR_PURCHASE && TOKEN_SALE_USDC_CONTRACT_ADDRESS;
  const saleContractAddress = useUSDC ? TOKEN_SALE_USDC_CONTRACT_ADDRESS : TOKEN_SALE_CONTRACT_ADDRESS;

  if (!saleContractAddress) {
    return null;
  }

  try {
    const provider = getBaseProvider();
    
    if (useUSDC) {
      const saleContract = new ethers.Contract(saleContractAddress, TOKEN_SALE_USDC_ABI, provider);
      const tokenDecimals = DEFAULT_TOKEN_DECIMALS;
      const tokenAmount = ethers.parseUnits(TOKEN_AMOUNT_TO_BUY, tokenDecimals);
      const costUSDC: bigint = await saleContract.costFor(tokenAmount);
      return ethers.formatUnits(costUSDC, 6);
    } else {
      const saleContract = new ethers.Contract(saleContractAddress, TOKEN_SALE_ABI, provider);
      const tokenDecimals = DEFAULT_TOKEN_DECIMALS;
      const tokenAmount = ethers.parseUnits(TOKEN_AMOUNT_TO_BUY, tokenDecimals);
      const costWei: bigint = await saleContract.costFor(tokenAmount);
      return ethers.formatEther(costWei);
    }
  } catch (error) {
    console.error('Error getting token sale price:', error);
    return null;
  }
}

// Получить стоимость покупки 0.10 MCT
export async function getPurchaseCost(): Promise<{
  costEth: string;
  costUsd?: string;
} | null> {
  if (!TOKEN_SALE_CONTRACT_ADDRESS) {
    return null;
  }

  try {
    const provider = getBaseProvider();
    const saleContract = new ethers.Contract(TOKEN_SALE_CONTRACT_ADDRESS, TOKEN_SALE_ABI, provider);
    
    const tokenDecimals = DEFAULT_TOKEN_DECIMALS;
    const tokenAmount = ethers.parseUnits(TOKEN_AMOUNT_TO_BUY, tokenDecimals);
    const costWei: bigint = await saleContract.costFor(tokenAmount);
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

    const saleContractAddress: string = USE_USDC_FOR_PURCHASE && TOKEN_SALE_USDC_CONTRACT_ADDRESS 
      ? TOKEN_SALE_USDC_CONTRACT_ADDRESS 
      : TOKEN_SALE_CONTRACT_ADDRESS;

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
    if (!TOKEN_SALE_USDC_CONTRACT_ADDRESS) {
      console.error('Token sale USDC contract address not configured');
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
    const contractAddressLower = TOKEN_SALE_USDC_CONTRACT_ADDRESS.toLowerCase();
    if (receiptTo !== contractAddressLower) {
      console.error('Transaction was not sent to token sale contract');
      return false;
    }

    // Создаем интерфейс контракта для парсинга событий
    const saleContract = new ethers.Contract(TOKEN_SALE_USDC_CONTRACT_ADDRESS, TOKEN_SALE_USDC_ABI, provider);
    
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

