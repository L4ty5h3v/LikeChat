const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Развертывание контракта продажи токенов (USDC)...\n");

  // Параметры развертывания
  const tokenAddress = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS || "0x04d388da70c32fc5876981097c536c51c8d3d236";
  const usdcAddress = process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  
  // Цена: 2.5 USDC за 1 токен (можно изменить)
  // Для 0.10 MCT это будет 0.25 USDC
  const pricePerTokenUSDC = hre.ethers.parseUnits("2.5", 6); // 2.5 USDC за 1 токен (USDC имеет 6 decimals)
  
  console.log("📋 Параметры развертывания:");
  console.log(`   Token Address: ${tokenAddress}`);
  console.log(`   USDC Address: ${usdcAddress}`);
  console.log(`   Price per token: ${hre.ethers.formatUnits(pricePerTokenUSDC, 6)} USDC`);
  console.log(`   Price for 0.10 MCT: ${hre.ethers.formatUnits(pricePerTokenUSDC * BigInt(1) / BigInt(10), 6)} USDC\n`);

  // Проверяем, что у нас есть приватный ключ
  if (!process.env.PRIVATE_KEY) {
    console.error("❌ Ошибка: PRIVATE_KEY не установлен в .env.local");
    console.error("   Добавьте PRIVATE_KEY=your-private-key в .env.local");
    console.error("   ⚠️  ВНИМАНИЕ: Никогда не коммитьте приватный ключ в Git!");
    process.exit(1);
  }

  // Получаем сеть
  const network = hre.network.name;
  console.log(`🌐 Сеть: ${network}\n`);

  // Развертываем контракт
  console.log("📦 Развертывание контракта MrsCryptoTokenSaleUSDC...");
  
  const TokenSaleUSDC = await hre.ethers.getContractFactory("MrsCryptoTokenSaleUSDC");
  const tokenSaleUSDC = await TokenSaleUSDC.deploy(tokenAddress, usdcAddress, pricePerTokenUSDC);
  
  await tokenSaleUSDC.waitForDeployment();
  const contractAddress = await tokenSaleUSDC.getAddress();
  
  console.log(`\n✅ Контракт развернут успешно!`);
  console.log(`   Адрес контракта: ${contractAddress}`);
  console.log(`   Сеть: ${network}`);
  console.log(`   Owner: ${await tokenSaleUSDC.owner()}\n`);

  // Проверяем цену
  const price = await tokenSaleUSDC.pricePerToken();
  console.log(`💰 Цена за 1 токен: ${hre.ethers.formatUnits(price, 6)} USDC`);
  
  // Проверяем стоимость 0.10 MCT
  const tokenAmount = hre.ethers.parseUnits("0.10", 18);
  const cost = await tokenSaleUSDC.costFor(tokenAmount);
  console.log(`💰 Стоимость 0.10 MCT: ${hre.ethers.formatUnits(cost, 6)} USDC\n`);

  // Сохраняем адрес в файл
  const deploymentInfo = {
    contractAddress,
    network,
    tokenAddress,
    usdcAddress,
    pricePerToken: price.toString(),
    deployedAt: new Date().toISOString(),
    deployer: (await hre.ethers.provider.getSigner()).address,
  };

  const deploymentFile = path.join(__dirname, "..", "deployments", `${network}-usdc.json`);
  const deploymentsDir = path.dirname(deploymentFile);
  
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`💾 Информация о развертывании сохранена в: ${deploymentFile}`);

  // Обновляем .env.local (если возможно)
  console.log("\n📝 Следующие шаги:");
  console.log(`   1. Добавьте в .env.local:`);
  console.log(`      NEXT_PUBLIC_TOKEN_SALE_USDC_CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`      NEXT_PUBLIC_USE_USDC_FOR_PURCHASE=true`);
  console.log(`   2. Проверьте контракт на BaseScan:`);
  
  if (network === "base") {
    console.log(`      https://basescan.org/address/${contractAddress}`);
  } else if (network === "baseSepolia") {
    console.log(`      https://sepolia.basescan.org/address/${contractAddress}`);
  }
  
  console.log(`   3. Переведите токены на контракт продажи:`);
  console.log(`      Адрес контракта: ${contractAddress}`);
  console.log(`      Количество: минимум для тестирования (например, 100 MCT)`);
  console.log(`\n✅ Развертывание завершено!\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Ошибка при развертывании:");
    console.error(error);
    process.exit(1);
  });

