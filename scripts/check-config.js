// Скрипт для проверки конфигурации перед тестированием покупки токена
const fs = require('fs');
const path = require('path');

console.log('🔍 Проверка конфигурации для покупки токена...\n');

// Читаем .env.local если существует
const envPath = path.join(process.cwd(), '.env.local');
let envVars = {};

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      envVars[key] = value;
    }
  });
} else {
  console.log('⚠️  Файл .env.local не найден!\n');
  console.log('Создайте .env.local на основе ENV_EXAMPLE.md\n');
  process.exit(1);
}

// Проверяем обязательные переменные
const requiredVars = [
  'NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS',
];

const optionalVars = [
  'NEXT_PUBLIC_TOKEN_SALE_CONTRACT_ADDRESS',
  'NEXT_PUBLIC_TOKEN_SALE_USDC_CONTRACT_ADDRESS',
  'NEXT_PUBLIC_USE_USDC_FOR_PURCHASE',
  'NEXT_PUBLIC_USDC_CONTRACT_ADDRESS',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'NEYNAR_API_KEY',
];

let hasErrors = false;
let hasWarnings = false;

console.log('📋 Проверка обязательных переменных:');
requiredVars.forEach(varName => {
  if (envVars[varName]) {
    console.log(`  ✅ ${varName}`);
  } else {
    console.log(`  ❌ ${varName} - НЕ УСТАНОВЛЕНА`);
    hasErrors = true;
  }
});

console.log('\n📋 Проверка переменных для покупки токена:');

// Проверяем конфигурацию покупки
const useUSDC = envVars['NEXT_PUBLIC_USE_USDC_FOR_PURCHASE'] === 'true';
const hasEthContract = !!envVars['NEXT_PUBLIC_TOKEN_SALE_CONTRACT_ADDRESS'];
const hasUsdcContract = !!envVars['NEXT_PUBLIC_TOKEN_SALE_USDC_CONTRACT_ADDRESS'];

if (useUSDC) {
  console.log('  💰 Режим покупки: USDC');
  if (hasUsdcContract) {
    console.log(`  ✅ NEXT_PUBLIC_TOKEN_SALE_USDC_CONTRACT_ADDRESS: ${envVars['NEXT_PUBLIC_TOKEN_SALE_USDC_CONTRACT_ADDRESS']}`);
  } else {
    console.log('  ❌ NEXT_PUBLIC_TOKEN_SALE_USDC_CONTRACT_ADDRESS - НЕ УСТАНОВЛЕНА');
    hasErrors = true;
  }
  
  if (envVars['NEXT_PUBLIC_USDC_CONTRACT_ADDRESS']) {
    console.log(`  ✅ NEXT_PUBLIC_USDC_CONTRACT_ADDRESS: ${envVars['NEXT_PUBLIC_USDC_CONTRACT_ADDRESS']}`);
  } else {
    console.log('  ⚠️  NEXT_PUBLIC_USDC_CONTRACT_ADDRESS - используется значение по умолчанию');
    hasWarnings = true;
  }
} else {
  console.log('  💰 Режим покупки: ETH');
  if (hasEthContract) {
    console.log(`  ✅ NEXT_PUBLIC_TOKEN_SALE_CONTRACT_ADDRESS: ${envVars['NEXT_PUBLIC_TOKEN_SALE_CONTRACT_ADDRESS']}`);
  } else {
    console.log('  ❌ NEXT_PUBLIC_TOKEN_SALE_CONTRACT_ADDRESS - НЕ УСТАНОВЛЕНА');
    hasErrors = true;
  }
}

if (!hasEthContract && !hasUsdcContract) {
  console.log('\n  ⚠️  ВНИМАНИЕ: Не настроен ни один контракт продажи!');
  console.log('     Установите NEXT_PUBLIC_TOKEN_SALE_CONTRACT_ADDRESS (ETH)');
  console.log('     или NEXT_PUBLIC_TOKEN_SALE_USDC_CONTRACT_ADDRESS (USDC)');
  hasErrors = true;
}

console.log('\n📋 Проверка опциональных переменных:');
optionalVars.forEach(varName => {
  if (envVars[varName]) {
    const value = varName.includes('TOKEN') || varName.includes('KEY') || varName.includes('URL') || varName.includes('TOKEN')
      ? `${envVars[varName].substring(0, 20)}...`
      : envVars[varName];
    console.log(`  ✅ ${varName}: ${value}`);
  } else {
    if (varName === 'UPSTASH_REDIS_REST_URL' || varName === 'UPSTASH_REDIS_REST_TOKEN') {
      console.log(`  ⚠️  ${varName} - не установлена (база данных может не работать)`);
      hasWarnings = true;
    } else if (varName === 'NEYNAR_API_KEY') {
      console.log(`  ⚠️  ${varName} - не установлена (некоторые функции могут не работать)`);
      hasWarnings = true;
    } else {
      console.log(`  ⚪ ${varName} - не установлена (опционально)`);
    }
  }
});

console.log('\n' + '='.repeat(50));

if (hasErrors) {
  console.log('\n❌ Обнаружены ошибки конфигурации!');
  console.log('   Исправьте ошибки перед тестированием.\n');
  process.exit(1);
} else if (hasWarnings) {
  console.log('\n⚠️  Конфигурация в порядке, но есть предупреждения.');
  console.log('   Рекомендуется исправить предупреждения.\n');
  process.exit(0);
} else {
  console.log('\n✅ Конфигурация в порядке!');
  console.log('   Можно начинать тестирование.\n');
  console.log('📝 Следующие шаги:');
  console.log('   1. Запустите: npm run dev');
  console.log('   2. Откройте: http://localhost:3000');
  console.log('   3. Перейдите на: /buyToken');
  console.log('   4. Следуйте инструкциям в QUICK_TEST.md\n');
  process.exit(0);
}

