// Простой скрипт развертывания через ethers.js
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: ".env.local" });

// Читаем контракт
const contractSource = fs.readFileSync(
  path.join(__dirname, "..", "contracts", "MrsCryptoTokenSale.sol"),
  "utf8"
);

async function main() {
  console.log("🚀 Развертывание контракта продажи токенов...\n");

  // Проверяем приватный ключ
  if (!process.env.PRIVATE_KEY) {
    console.error("❌ Ошибка: PRIVATE_KEY не установлен в .env.local");
    console.error("   Добавьте PRIVATE_KEY=your-private-key в .env.local");
    console.error("   ⚠️  ВНИМАНИЕ: Никогда не коммитьте приватный ключ в Git!");
    process.exit(1);
  }

  // Параметры
  const tokenAddress = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS || "0x04d388da70c32fc5876981097c536c51c8d3d236";
  const pricePerTokenWei = ethers.parseEther("0.001"); // 0.001 ETH за 1 токен
  
  console.log("📋 Параметры развертывания:");
  console.log(`   Token Address: ${tokenAddress}`);
  console.log(`   Price per token: ${ethers.formatEther(pricePerTokenWei)} ETH`);
  console.log(`   Price for 0.10 MCT: ${ethers.formatEther(pricePerTokenWei * BigInt(1) / BigInt(10))} ETH\n`);

  // Подключаемся к Base
  const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org";
  console.log(`🌐 Подключение к Base: ${rpcUrl}`);
  
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  console.log(`   Адрес кошелька: ${wallet.address}\n`);

  // Проверяем баланс
  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Баланс: ${ethers.formatEther(balance)} ETH`);
  
  if (balance < ethers.parseEther("0.001")) {
    console.error("❌ Недостаточно ETH для развертывания!");
    console.error("   Пополните кошелек минимум на 0.001 ETH");
    process.exit(1);
  }

  // ABI контракта (минимальный для развертывания)
  const contractABI = [
    "constructor(address token_, uint256 pricePerTokenWei)",
    "function pricePerToken() view returns (uint256)",
    "function costFor(uint256 tokenAmount) view returns (uint256)",
    "function owner() view returns (address)",
  ];

  // Байткод контракта (нужно скомпилировать через Remix или другой инструмент)
  console.log("⚠️  ВНИМАНИЕ: Для развертывания нужен скомпилированный байткод контракта.");
  console.log("   Рекомендуется использовать Remix IDE для компиляции и развертывания:\n");
  console.log("   1. Откройте https://remix.ethereum.org");
  console.log("   2. Создайте файл MrsCryptoTokenSale.sol");
  console.log("   3. Скопируйте код из contracts/MrsCryptoTokenSale.sol");
  console.log("   4. Установите компилятор на 0.8.20");
  console.log("   5. Скомпилируйте контракт");
  console.log("   6. Разверните через Injected Provider (MetaMask)");
  console.log("   7. Используйте параметры:");
  console.log(`      - token_: ${tokenAddress}`);
  console.log(`      - pricePerTokenWei: ${pricePerTokenWei.toString()}\n`);
  
  console.log("📝 Или используйте готовый скрипт для Remix в DEPLOY_REMIX.md\n");
  
  process.exit(0);
}

main().catch((error) => {
  console.error("\n❌ Ошибка:");
  console.error(error);
  process.exit(1);
});

