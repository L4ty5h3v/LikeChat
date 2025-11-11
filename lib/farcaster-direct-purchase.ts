// Прямая покупка MCT через контракт продажи (транзакция в Farcaster кошельке)
import { ethers } from 'ethers';

// Константы
const TOKEN_CONTRACT_ADDRESS = '0x04d388da70c32fc5876981097c536c51c8d3d236'; // MCT Token
const TOKEN_SALE_CONTRACT_ADDRESS = ''; // АДРЕС КОНТРАКТА ПРОДАЖИ - НУЖНО РАЗВЕРНУТЬ!
const TOKEN_SALE_USDC_CONTRACT_ADDRESS = ''; // АДРЕС КОНТРАКТА ПРОДАЖИ USDC - НУЖНО РАЗВЕРНУТЬ!
const USDC_CONTRACT_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC на Base
const TOKEN_AMOUNT_TO_BUY = '0.10'; // Покупаем 0.10 MCT
const DEFAULT_TOKEN_DECIMALS = 18;
const BASE_CHAIN_ID = 8453;

// ABI для контракта продажи (ETH)
const TOKEN_SALE_ABI = [
  'function buyTokens(uint256 tokenAmount) payable returns (bool)',
  'function costFor(uint256 tokenAmount) view returns (uint256)',
  'function availableTokens() view returns (uint256)',
];

// ABI для контракта продажи (USDC)
const TOKEN_SALE_USDC_ABI = [
  'function buyTokens(uint256 tokenAmount) returns (bool)',
  'function costFor(uint256 tokenAmount) view returns (uint256)',
  'function availableTokens() view returns (uint256)',
];

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

// Получить цену из контракта продажи (для отображения на фронтенде)
export async function getPriceFromSaleContract(
  paymentToken: 'ETH' | 'USDC' = 'ETH'
): Promise<string | null> {
  try {
    // Используем публичный RPC для чтения (не требует подключения кошелька)
    const BASE_RPC_URL = 'https://mainnet.base.org';
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    
    const tokenAmount = ethers.parseUnits(TOKEN_AMOUNT_TO_BUY, DEFAULT_TOKEN_DECIMALS);
    
    if (paymentToken === 'USDC') {
      if (!TOKEN_SALE_USDC_CONTRACT_ADDRESS) {
        return null;
      }
      
      const saleContract = new ethers.Contract(TOKEN_SALE_USDC_CONTRACT_ADDRESS, TOKEN_SALE_USDC_ABI, provider);
      const cost: bigint = await saleContract.costFor(tokenAmount);
      return ethers.formatUnits(cost, 6); // USDC имеет 6 decimals
    } else {
      if (!TOKEN_SALE_CONTRACT_ADDRESS) {
        return null;
      }
      
      const saleContract = new ethers.Contract(TOKEN_SALE_CONTRACT_ADDRESS, TOKEN_SALE_ABI, provider);
      const cost: bigint = await saleContract.costFor(tokenAmount);
      return ethers.formatEther(cost); // ETH имеет 18 decimals
    }
  } catch (error) {
    console.error('Error getting price from sale contract:', error);
    return null;
  }
}

// Прямая покупка MCT через контракт продажи (ETH)
export async function buyTokenViaDirectPurchase(
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
        error: 'Покупка доступна только на клиенте',
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

    const tokenAmount = ethers.parseUnits(TOKEN_AMOUNT_TO_BUY, DEFAULT_TOKEN_DECIMALS);

    if (paymentToken === 'USDC') {
      // Покупка через USDC контракт
      if (!TOKEN_SALE_USDC_CONTRACT_ADDRESS) {
        return {
          success: false,
          error: 'Контракт продажи USDC не развернут. Обратитесь к разработчику.',
        };
      }

      // Проверяем approve USDC
      const usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, ERC20_ABI, signer);
      const saleContract = new ethers.Contract(TOKEN_SALE_USDC_CONTRACT_ADDRESS, TOKEN_SALE_USDC_ABI, signer);
      
      // Получаем стоимость
      const cost = await saleContract.costFor(tokenAmount);
      const currentAllowance = await usdcContract.allowance(userAddress, TOKEN_SALE_USDC_CONTRACT_ADDRESS);
      
      if (currentAllowance < cost) {
        console.log('🔄 Approving USDC spending...');
        const approveTx = await usdcContract.approve(TOKEN_SALE_USDC_CONTRACT_ADDRESS, ethers.MaxUint256, {
          gasLimit: 100000,
        });
        
        console.log('✅ Approval transaction sent:', approveTx.hash);
        await approveTx.wait();
        console.log('✅ Approval confirmed');
      } else {
        console.log('✅ USDC already approved');
      }

      // Покупаем токены
      console.log(`🔄 Purchasing ${TOKEN_AMOUNT_TO_BUY} MCT via USDC contract...`);
      const tx = await saleContract.buyTokens(tokenAmount, {
        gasLimit: 300000,
      });

      console.log('✅ Purchase transaction sent:', tx.hash);
      console.log('📋 Transaction will be visible in Farcaster wallet history');
      
      const receipt = await tx.wait();

      if (receipt.status === 1) {
        console.log('✅ Purchase confirmed');
        
        // Проверяем баланс
        const tokenContract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, ERC20_ABI, provider);
        const balance = await tokenContract.balanceOf(userAddress);
        const decimals = await tokenContract.decimals().catch(() => DEFAULT_TOKEN_DECIMALS);
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
    } else {
      // Покупка через ETH контракт
      if (!TOKEN_SALE_CONTRACT_ADDRESS) {
        return {
          success: false,
          error: 'Контракт продажи не развернут. Обратитесь к разработчику.',
        };
      }

      const saleContract = new ethers.Contract(TOKEN_SALE_CONTRACT_ADDRESS, TOKEN_SALE_ABI, signer);
      
      // Получаем стоимость
      const cost = await saleContract.costFor(tokenAmount);
      
      console.log(`🔄 Purchasing ${TOKEN_AMOUNT_TO_BUY} MCT via ETH contract...`);
      console.log(`   Cost: ${ethers.formatEther(cost)} ETH`);
      
      // Покупаем токены (отправляем ETH)
      const tx = await saleContract.buyTokens(tokenAmount, {
        value: cost,
        gasLimit: 300000,
      });

      console.log('✅ Purchase transaction sent:', tx.hash);
      console.log('📋 Transaction will be visible in Farcaster wallet history');
      
      const receipt = await tx.wait();

      if (receipt.status === 1) {
        console.log('✅ Purchase confirmed');
        
        // Проверяем баланс
        const tokenContract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, ERC20_ABI, provider);
        const balance = await tokenContract.balanceOf(userAddress);
        const decimals = await tokenContract.decimals().catch(() => DEFAULT_TOKEN_DECIMALS);
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
    }
  } catch (error: any) {
    console.error('❌ Error in direct purchase:', error);
    
    let errorMessage = 'Ошибка при покупке токена';
    
    if (error.message?.includes('user rejected')) {
      errorMessage = 'Транзакция отменена пользователем';
    } else if (error.message?.includes('insufficient funds')) {
      errorMessage = 'Недостаточно средств для покупки';
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

