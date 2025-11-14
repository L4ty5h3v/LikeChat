// Скрипт для проверки баланса контракта
const { ethers } = require('ethers');

// Константы
const MCT_TOKEN_ADDRESS = '0x04d388da70c32fc5876981097c536c51c8d3d236';
const CONTRACT_ADDRESS = '0x3FD7a1D5C9C3163E873Df212006cB81D7178f3b4';
const BASE_RPC_URL = 'https://mainnet.base.org';

// ABI для ERC20 токена
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

async function checkBalance() {
  try {
    console.log('🔍 Checking contract balance...\n');
    
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const mctToken = new ethers.Contract(MCT_TOKEN_ADDRESS, ERC20_ABI, provider);
    
    const decimals = await mctToken.decimals();
    const balance = await mctToken.balanceOf(CONTRACT_ADDRESS);
    const balanceFormatted = ethers.formatUnits(balance, decimals);
    
    console.log('📍 Contract address:', CONTRACT_ADDRESS);
    console.log('🪙 MCT Token address:', MCT_TOKEN_ADDRESS);
    console.log('💰 Contract MCT balance:', balanceFormatted, 'MCT');
    
    if (balance > 0n) {
      console.log('\n✅ Contract is funded and ready for token sales!');
      console.log('🎉 Users can now purchase MCT tokens through the contract');
    } else {
      console.log('\n⚠️  Contract has 0 MCT tokens');
      console.log('   Please send MCT tokens to the contract address');
    }
    
  } catch (error) {
    console.error('❌ Error checking balance:', error.message);
  }
}

checkBalance();


