// Скрипт для развертывания контракта MCTTokenSale на Base
const { ethers } = require('ethers');

// Константы
const MCT_TOKEN_ADDRESS = '0x04d388da70c32fc5876981097c536c51c8d3d236';
const USDC_TOKEN_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_RPC_URL = 'https://mainnet.base.org';

// ABI контракта (только для развертывания)
const CONTRACT_BYTECODE = '0x608060405234801561001057600080fd5b50604051610...'; // Нужно скомпилировать контракт

// ABI конструктора
const CONTRACT_ABI = [
  'constructor(address _mctToken, address _usdcToken)',
];

async function deployContract() {
  try {
    console.log('🚀 Starting contract deployment...');
    
    // Проверяем наличие приватного ключа
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      console.error('❌ Error: PRIVATE_KEY environment variable is not set');
      console.log('\n📝 To deploy:');
      console.log('1. Set your private key: export PRIVATE_KEY=your_private_key');
      console.log('2. Run: node scripts/deploy-contract.js');
      console.log('\n⚠️  WARNING: Never commit your private key to git!');
      return;
    }

    // Создаем провайдер и кошелек
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log('📋 Deployer address:', wallet.address);
    
    // Проверяем баланс
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Balance:', ethers.formatEther(balance), 'ETH');
    
    if (balance < ethers.parseEther('0.001')) {
      console.error('❌ Error: Insufficient balance. Need at least 0.001 ETH for deployment');
      return;
    }

    // Читаем контракт из файла (нужно скомпилировать сначала)
    console.log('\n⚠️  Note: This script requires compiled contract bytecode.');
    console.log('📝 Recommended: Use Remix IDE to deploy:');
    console.log('   1. Open https://remix.ethereum.org/');
    console.log('   2. Create file: contracts/MCTTokenSale.sol');
    console.log('   3. Copy contract code');
    console.log('   4. Compile with Solidity 0.8.20+');
    console.log('   5. Deploy with parameters:');
    console.log(`      _mctToken: ${MCT_TOKEN_ADDRESS}`);
    console.log(`      _usdcToken: ${USDC_TOKEN_ADDRESS}`);
    console.log('   6. Copy deployed contract address');
    
    // Альтернатива: можно использовать Hardhat или другой инструмент
    console.log('\n💡 Alternative: Use Hardhat or Foundry for deployment');
    
  } catch (error) {
    console.error('❌ Deployment error:', error.message);
    if (error.code === 'INSUFFICIENT_FUNDS') {
      console.error('   Insufficient funds for deployment');
    }
  }
}

// Запускаем развертывание
deployContract();



