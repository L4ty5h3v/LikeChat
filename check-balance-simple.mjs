// Простой скрипт для проверки баланса контракта
import { createPublicClient, http, formatEther } from 'viem';
import { base } from 'viem/chains';

const CONTRACT_ADDRESS = '0xcd7092246c5DB86bC65C98fD943A18d409fCf03D';
const MCT_TOKEN_ADDRESS = '0x265Be18eC58cDB1d86FDCD10D2c7b0C215919230';

const DAILY_REWARDS_ABI = [
  {
    inputs: [],
    name: 'getContractBalance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'dailyRewardAmount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

const ERC20_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function checkBalance() {
  console.log('🔍 Проверка баланса контракта...\n');
  console.log(`Контракт: ${CONTRACT_ADDRESS}`);
  console.log(`Токен MCT: ${MCT_TOKEN_ADDRESS}\n`);

  const client = createPublicClient({
    chain: base,
    transport: http(),
  });

  try {
    // Баланс через функцию контракта
    const contractBalance = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: DAILY_REWARDS_ABI,
      functionName: 'getContractBalance',
    });

    console.log(`✅ Баланс контракта: ${formatEther(contractBalance)} MCT`);

    // Размер награды
    const dailyReward = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: DAILY_REWARDS_ABI,
      functionName: 'dailyRewardAmount',
    });

    console.log(`💰 Размер награды: ${formatEther(dailyReward)} MCT`);

    // Проверка через прямой баланс токена
    const tokenBalance = await client.readContract({
      address: MCT_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [CONTRACT_ADDRESS],
    });

    console.log(`📊 Баланс токенов (прямая проверка): ${formatEther(tokenBalance)} MCT`);

    // Сколько клеймов можно сделать
    const canPay = contractBalance >= dailyReward;
    const possibleClaims = contractBalance / dailyReward;

    console.log(`\n${canPay ? '✅' : '❌'} Можно выплачивать награды: ${canPay}`);
    console.log(`📈 Возможных клеймов: ~${Number(possibleClaims)}`);

    if (!canPay) {
      console.log(`\n⚠️  ВНИМАНИЕ: Баланс недостаточен!`);
      console.log(`   Нужно: ${formatEther(dailyReward)} MCT`);
      console.log(`   Есть: ${formatEther(contractBalance)} MCT`);
      console.log(`   Не хватает: ${formatEther(dailyReward - contractBalance)} MCT`);
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

checkBalance();






