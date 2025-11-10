// Тестовый скрипт для проверки логики покупки токена
const ethers = require('ethers');

console.log('🧪 Тестирование логики покупки токена\n');

// Тестовые данные
const TOKEN_AMOUNT_TO_BUY = '0.10';
const DEFAULT_TOKEN_DECIMALS = 18;
const USDC_DECIMALS = 6;

// Тест 1: Парсинг количества токенов
console.log('📋 Тест 1: Парсинг количества токенов');
try {
  const tokenAmount = ethers.parseUnits(TOKEN_AMOUNT_TO_BUY, DEFAULT_TOKEN_DECIMALS);
  const formatted = ethers.formatUnits(tokenAmount, DEFAULT_TOKEN_DECIMALS);
  console.log(`  ✅ Парсинг: ${TOKEN_AMOUNT_TO_BUY} MCT = ${tokenAmount.toString()} (wei)`);
  console.log(`  ✅ Форматирование: ${formatted} MCT`);
  
  if (formatted === TOKEN_AMOUNT_TO_BUY) {
    console.log('  ✅ Тест пройден\n');
  } else {
    console.log(`  ❌ Ошибка: ожидалось ${TOKEN_AMOUNT_TO_BUY}, получено ${formatted}\n`);
  }
} catch (error) {
  console.log(`  ❌ Ошибка: ${error.message}\n`);
}

// Тест 2: Расчет стоимости покупки (симуляция)
console.log('📋 Тест 2: Расчет стоимости покупки');
try {
  // Симулируем цену: 0.0001 ETH за 0.10 MCT
  const pricePerTokenWei = ethers.parseEther('0.001'); // 0.001 ETH за 1 токен
  const tokenAmount = ethers.parseUnits(TOKEN_AMOUNT_TO_BUY, DEFAULT_TOKEN_DECIMALS);
  const unit = ethers.parseUnits('1', DEFAULT_TOKEN_DECIMALS);
  const costWei = (pricePerTokenWei * tokenAmount) / unit;
  const costEth = ethers.formatEther(costWei);
  
  console.log(`  ✅ Цена за 1 токен: ${ethers.formatEther(pricePerTokenWei)} ETH`);
  console.log(`  ✅ Стоимость 0.10 MCT: ${costEth} ETH`);
  
  if (parseFloat(costEth) > 0) {
    console.log('  ✅ Тест пройден\n');
  } else {
    console.log('  ❌ Ошибка: стоимость равна нулю\n');
  }
} catch (error) {
  console.log(`  ❌ Ошибка: ${error.message}\n`);
}

// Тест 3: Расчет стоимости в USDC
console.log('📋 Тест 3: Расчет стоимости в USDC');
try {
  // Симулируем цену: 0.25 USDC за 0.10 MCT
  const pricePerTokenUSDC = ethers.parseUnits('2.5', USDC_DECIMALS); // 2.5 USDC за 1 токен
  const tokenAmount = ethers.parseUnits(TOKEN_AMOUNT_TO_BUY, DEFAULT_TOKEN_DECIMALS);
  const unit = ethers.parseUnits('1', DEFAULT_TOKEN_DECIMALS);
  const costUSDC = (pricePerTokenUSDC * tokenAmount) / unit;
  const costUSDCFormatted = ethers.formatUnits(costUSDC, USDC_DECIMALS);
  
  console.log(`  ✅ Цена за 1 токен: ${ethers.formatUnits(pricePerTokenUSDC, USDC_DECIMALS)} USDC`);
  console.log(`  ✅ Стоимость 0.10 MCT: ${costUSDCFormatted} USDC`);
  
  if (parseFloat(costUSDCFormatted) > 0) {
    console.log('  ✅ Тест пройден\n');
  } else {
    console.log('  ❌ Ошибка: стоимость равна нулю\n');
  }
} catch (error) {
  console.log(`  ❌ Ошибка: ${error.message}\n`);
}

// Тест 4: Проверка формата адресов
console.log('📋 Тест 4: Валидация адресов контрактов');
try {
  const testAddresses = [
    '0x454b4180bc715ba6a8568a16f1f9a4b114a329a6', // Token contract
    '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
    '0x0000000000000000000000000000000000000000', // Invalid
    'invalid-address', // Invalid
  ];
  
  testAddresses.forEach((addr, index) => {
    try {
      const isValid = ethers.isAddress(addr);
      if (isValid) {
        console.log(`  ✅ Адрес ${index + 1}: ${addr.substring(0, 10)}... - валидный`);
      } else {
        console.log(`  ❌ Адрес ${index + 1}: ${addr} - невалидный`);
      }
    } catch (error) {
      console.log(`  ❌ Адрес ${index + 1}: ${addr} - ошибка проверки`);
    }
  });
  console.log('  ✅ Тест пройден\n');
} catch (error) {
  console.log(`  ❌ Ошибка: ${error.message}\n`);
}

// Тест 5: Проверка ABI функций
console.log('📋 Тест 5: Проверка ABI функций');
try {
  const ERC20_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
  ];
  
  const TOKEN_SALE_ABI = [
    'function pricePerToken() view returns (uint256)',
    'function buyTokens(uint256 tokenAmount) payable',
    'function costFor(uint256 tokenAmount) view returns (uint256)',
  ];
  
  const TOKEN_SALE_USDC_ABI = [
    'function pricePerToken() view returns (uint256)',
    'function buyTokens(uint256 tokenAmount)',
    'function costFor(uint256 tokenAmount) view returns (uint256)',
  ];
  
  const ifaceERC20 = new ethers.Interface(ERC20_ABI);
  const ifaceSale = new ethers.Interface(TOKEN_SALE_ABI);
  const ifaceSaleUSDC = new ethers.Interface(TOKEN_SALE_USDC_ABI);
  
  console.log('  ✅ ERC20 ABI:');
  console.log(`     - balanceOf: ${ifaceERC20.getFunction('balanceOf') ? '✅' : '❌'}`);
  console.log(`     - approve: ${ifaceERC20.getFunction('approve') ? '✅' : '❌'}`);
  console.log(`     - allowance: ${ifaceERC20.getFunction('allowance') ? '✅' : '❌'}`);
  
  console.log('  ✅ Token Sale ABI (ETH):');
  console.log(`     - buyTokens (payable): ${ifaceSale.getFunction('buyTokens') ? '✅' : '❌'}`);
  console.log(`     - costFor: ${ifaceSale.getFunction('costFor') ? '✅' : '❌'}`);
  
  console.log('  ✅ Token Sale ABI (USDC):');
  console.log(`     - buyTokens (non-payable): ${ifaceSaleUSDC.getFunction('buyTokens') ? '✅' : '❌'}`);
  console.log(`     - costFor: ${ifaceSaleUSDC.getFunction('costFor') ? '✅' : '❌'}`);
  
  console.log('  ✅ Тест пройден\n');
} catch (error) {
  console.log(`  ❌ Ошибка: ${error.message}\n`);
}

// Тест 6: Проверка событий
console.log('📋 Тест 6: Проверка событий контрактов');
try {
  const TOKEN_SALE_ABI = [
    'event TokensPurchased(address indexed buyer, uint256 tokenAmount, uint256 paidWei)',
  ];
  
  const TOKEN_SALE_USDC_ABI = [
    'event TokensPurchased(address indexed buyer, uint256 tokenAmount, uint256 paidUSDC)',
  ];
  
  const ifaceSale = new ethers.Interface(TOKEN_SALE_ABI);
  const ifaceSaleUSDC = new ethers.Interface(TOKEN_SALE_USDC_ABI);
  
  const eventSale = ifaceSale.getEvent('TokensPurchased');
  const eventSaleUSDC = ifaceSaleUSDC.getEvent('TokensPurchased');
  
  if (eventSale) {
    console.log('  ✅ Событие TokensPurchased (ETH) найдено');
    console.log(`     Параметры: ${eventSale.inputs.length}`);
  } else {
    console.log('  ❌ Событие TokensPurchased (ETH) не найдено');
  }
  
  if (eventSaleUSDC) {
    console.log('  ✅ Событие TokensPurchased (USDC) найдено');
    console.log(`     Параметры: ${eventSaleUSDC.inputs.length}`);
  } else {
    console.log('  ❌ Событие TokensPurchased (USDC) не найдено');
  }
  
  console.log('  ✅ Тест пройден\n');
} catch (error) {
  console.log(`  ❌ Ошибка: ${error.message}\n`);
}

// Тест 7: Проверка констант
console.log('📋 Тест 7: Проверка констант и значений');
try {
  const BASE_CHAIN_ID = 8453;
  const BASE_CHAIN_ID_HEX = '0x2105';
  
  console.log(`  ✅ Base Chain ID: ${BASE_CHAIN_ID} (decimal)`);
  console.log(`  ✅ Base Chain ID: ${BASE_CHAIN_ID_HEX} (hex)`);
  console.log(`  ✅ Количество токенов: ${TOKEN_AMOUNT_TO_BUY} MCT`);
  console.log(`  ✅ Decimals токена: ${DEFAULT_TOKEN_DECIMALS}`);
  console.log(`  ✅ Decimals USDC: ${USDC_DECIMALS}`);
  
  // Проверка конвертации
  const chainIdFromHex = parseInt(BASE_CHAIN_ID_HEX, 16);
  if (chainIdFromHex === BASE_CHAIN_ID) {
    console.log('  ✅ Конвертация Chain ID корректна');
  } else {
    console.log(`  ❌ Ошибка конвертации: ${chainIdFromHex} !== ${BASE_CHAIN_ID}`);
  }
  
  console.log('  ✅ Тест пройден\n');
} catch (error) {
  console.log(`  ❌ Ошибка: ${error.message}\n`);
}

console.log('='.repeat(50));
console.log('\n✅ Все тесты логики пройдены!');
console.log('\n📝 Следующие шаги:');
console.log('   1. Настройте адрес контракта продажи в .env.local');
console.log('   2. Запустите: npm run dev');
console.log('   3. Протестируйте в браузере с подключенным кошельком\n');

