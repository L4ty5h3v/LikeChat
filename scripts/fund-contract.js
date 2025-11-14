// Скрипт для пополнения контракта MCT токенами
require('dotenv').config();
const { ethers } = require('ethers');

// Константы
const MCT_TOKEN_ADDRESS = '0x04d388da70c32fc5876981097c536c51c8d3d236';
const CONTRACT_ADDRESS = '0x3FD7a1D5C9C3163E873Df212006cB81D7178f3b4';
const BASE_RPC_URL = 'https://mainnet.base.org';

// ABI для ERC20 токена
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

async function fundContract() {
  try {
    console.log('💰 Funding contract with MCT tokens...\n');
    
    // Проверяем наличие приватного ключа
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      console.error('❌ Error: PRIVATE_KEY environment variable is not set');
      return;
    }

    // Создаем провайдер и кошелек
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log('📋 Wallet address:', wallet.address);
    console.log('📍 Contract address:', CONTRACT_ADDRESS);
    console.log('🪙 MCT Token address:', MCT_TOKEN_ADDRESS);
    
    // Создаем контракт MCT токена
    const mctToken = new ethers.Contract(MCT_TOKEN_ADDRESS, ERC20_ABI, wallet);
    
    // Получаем decimals токена
    const decimals = await mctToken.decimals();
    console.log('📊 Token decimals:', decimals);
    
    // Проверяем баланс кошелька
    const walletBalance = await mctToken.balanceOf(wallet.address);
    const walletBalanceFormatted = ethers.formatUnits(walletBalance, decimals);
    console.log('💰 Your MCT balance:', walletBalanceFormatted, 'MCT');
    
    if (walletBalance === 0n) {
      console.error('\n❌ Error: You have 0 MCT tokens');
      console.log('   Please get MCT tokens first before funding the contract');
      return;
    }
    
    // Проверяем текущий баланс контракта
    const contractBalance = await mctToken.balanceOf(CONTRACT_ADDRESS);
    const contractBalanceFormatted = ethers.formatUnits(contractBalance, decimals);
    console.log('📦 Contract MCT balance:', contractBalanceFormatted, 'MCT');
    
    // Спрашиваем, сколько перевести (можно сделать интерактивным, но для простоты переведем все)
    console.log('\n💡 Options:');
    console.log('   1. Transfer all MCT tokens to contract');
    console.log('   2. Transfer specific amount (edit script to set amount)');
    
    // Для автоматизации - переводим все токены
    // Если хотите перевести конкретную сумму, измените эту строку:
    const amountToTransfer = walletBalance; // Переводим все
    
    // Или укажите конкретную сумму (например, 1000 токенов):
    // const amountToTransfer = ethers.parseUnits('1000', decimals);
    
    const amountFormatted = ethers.formatUnits(amountToTransfer, decimals);
    console.log(`\n📤 Transferring ${amountFormatted} MCT to contract...`);
    
    // Отправляем транзакцию
    const tx = await mctToken.transfer(CONTRACT_ADDRESS, amountToTransfer, {
      gasLimit: 100000,
    });
    
    console.log('⏳ Transaction sent:', tx.hash);
    console.log('   Waiting for confirmation...');
    
    // Ждем подтверждения
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      console.log('\n✅ Tokens transferred successfully!');
      
      // Проверяем новый баланс контракта
      const newContractBalance = await mctToken.balanceOf(CONTRACT_ADDRESS);
      const newContractBalanceFormatted = ethers.formatUnits(newContractBalance, decimals);
      console.log('📦 New contract MCT balance:', newContractBalanceFormatted, 'MCT');
      
      console.log('\n🎉 Contract is now funded and ready for token sales!');
    } else {
      console.error('\n❌ Transaction failed');
    }
    
  } catch (error) {
    console.error('\n❌ Error funding contract:');
    if (error.reason) {
      console.error('   Reason:', error.reason);
    }
    if (error.message) {
      console.error('   Message:', error.message);
    }
    process.exit(1);
  }
}

// Запускаем пополнение
fundContract();


