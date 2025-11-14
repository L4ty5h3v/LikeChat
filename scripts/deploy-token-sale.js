// Автоматический деплой контракта MCTTokenSale на Base
require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Константы
const MCT_TOKEN_ADDRESS = '0x04d388da70c32fc5876981097c536c51c8d3d236';
const USDC_TOKEN_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_RPC_URL = 'https://mainnet.base.org';

async function deployContract() {
  try {
    console.log('🚀 Starting contract deployment to Base...\n');
    
    // Проверяем наличие приватного ключа
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      console.error('❌ Error: PRIVATE_KEY environment variable is not set');
      console.log('\n📝 To deploy:');
      console.log('1. Create a .env file in the project root');
      console.log('2. Add: PRIVATE_KEY=your_private_key_here');
      console.log('3. Run: node scripts/deploy-token-sale.js');
      console.log('\n⚠️  WARNING: Never commit your private key to git!');
      console.log('   Add .env to .gitignore');
      return;
    }

    // Читаем скомпилированный артефакт
    const artifactPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'MCTTokenSale.json');
    if (!fs.existsSync(artifactPath)) {
      console.error('❌ Error: Contract artifact not found');
      console.log('   Please compile the contract first: node compile-contract.js');
      return;
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    console.log('✅ Contract artifact loaded');

    // Создаем провайдер и кошелек
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log('📋 Deployer address:', wallet.address);
    
    // Проверяем баланс
    const balance = await provider.getBalance(wallet.address);
    const balanceEth = ethers.formatEther(balance);
    console.log('💰 Balance:', balanceEth, 'ETH');
    
    if (balance < ethers.parseEther('0.001')) {
      console.error('\n❌ Error: Insufficient balance');
      console.log('   Need at least 0.001 ETH for deployment');
      console.log('   Current balance:', balanceEth, 'ETH');
      return;
    }

    console.log('\n📦 Deploying contract...');
    console.log('   MCT Token:', MCT_TOKEN_ADDRESS);
    console.log('   USDC Token:', USDC_TOKEN_ADDRESS);

    // Создаем фабрику контракта
    const factory = new ethers.ContractFactory(
      artifact.abi,
      artifact.bytecode,
      wallet
    );

    // Деплоим контракт с параметрами конструктора
    const contract = await factory.deploy(
      MCT_TOKEN_ADDRESS,
      USDC_TOKEN_ADDRESS,
      {
        gasLimit: 2000000, // Увеличиваем лимит газа для надежности
      }
    );

    console.log('\n⏳ Transaction sent:', contract.deploymentTransaction().hash);
    console.log('   Waiting for confirmation...');

    // Ждем подтверждения
    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();

    console.log('\n✅ Contract deployed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 Contract Address:', contractAddress);
    console.log('🔗 View on BaseScan: https://basescan.org/address/' + contractAddress);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Проверяем деплой
    console.log('🔍 Verifying deployment...');
    const code = await provider.getCode(contractAddress);
    if (code === '0x') {
      console.error('❌ Error: Contract code not found at address');
      return;
    }
    console.log('✅ Contract code verified');

    // Проверяем параметры контракта
    const owner = await contract.owner();
    const mctToken = await contract.mctToken();
    const usdcToken = await contract.usdcToken();
    const priceETH = await contract.pricePerTokenETH();
    const priceUSDC = await contract.pricePerTokenUSDC();

    console.log('\n📊 Contract Parameters:');
    console.log('   Owner:', owner);
    console.log('   MCT Token:', mctToken);
    console.log('   USDC Token:', usdcToken);
    console.log('   Price ETH:', ethers.formatEther(priceETH), 'ETH');
    console.log('   Price USDC:', ethers.formatUnits(priceUSDC, 6), 'USDC');

    // Сохраняем адрес в файл
    const deploymentInfo = {
      contractAddress,
      deployer: wallet.address,
      network: 'base',
      chainId: 8453,
      deployedAt: new Date().toISOString(),
      transactionHash: contract.deploymentTransaction().hash,
      mctToken: MCT_TOKEN_ADDRESS,
      usdcToken: USDC_TOKEN_ADDRESS,
    };

    const deploymentPath = path.join(__dirname, '..', 'deployment.json');
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log('\n💾 Deployment info saved to:', deploymentPath);

    console.log('\n🎉 Deployment complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Set environment variable: NEXT_PUBLIC_TOKEN_SALE_CONTRACT_ADDRESS=' + contractAddress);
    console.log('2. Fund the contract with MCT tokens');
    console.log('3. Update the contract address in your Vercel environment variables');
    
  } catch (error) {
    console.error('\n❌ Deployment failed:');
    if (error.reason) {
      console.error('   Reason:', error.reason);
    }
    if (error.message) {
      console.error('   Message:', error.message);
    }
    if (error.transaction) {
      console.error('   Transaction:', error.transaction);
    }
    process.exit(1);
  }
}

// Запускаем деплой
deployContract();

