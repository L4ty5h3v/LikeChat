const solc = require('solc');
const fs = require('fs');
const path = require('path');

// Читаем контракт
const contractPath = path.join(__dirname, 'contracts', 'MCTTokenSale.sol');
const contractSource = fs.readFileSync(contractPath, 'utf8');

console.log('📄 Reading contract from:', contractPath);
console.log('📝 Contract size:', contractSource.length, 'characters');

// Настройки компилятора
const input = {
  language: 'Solidity',
  sources: {
    'MCTTokenSale.sol': {
      content: contractSource,
    },
  },
  settings: {
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode'],
      },
    },
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },
};

console.log('\n🔨 Compiling contract...');

try {
  // Компилируем
  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  // Проверяем ошибки
  if (output.errors) {
    const errors = output.errors.filter(e => e.severity === 'error');
    if (errors.length > 0) {
      console.error('\n❌ Compilation errors:');
      errors.forEach(error => {
        console.error(`  ${error.message}`);
      });
      process.exit(1);
    }
    
    const warnings = output.errors.filter(e => e.severity === 'warning');
    if (warnings.length > 0) {
      console.warn('\n⚠️  Compilation warnings:');
      warnings.forEach(warning => {
        console.warn(`  ${warning.message}`);
      });
    }
  }

  // Получаем скомпилированный контракт
  const contract = output.contracts['MCTTokenSale.sol']['MCTTokenSale'];
  
  if (!contract) {
    console.error('❌ Contract not found in compilation output');
    process.exit(1);
  }

  // Создаем папку для артефактов
  const artifactsDir = path.join(__dirname, 'artifacts', 'contracts');
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  // Сохраняем ABI и байт-код
  const artifact = {
    contractName: 'MCTTokenSale',
    abi: contract.abi,
    bytecode: contract.evm.bytecode.object,
    deployedBytecode: contract.evm.deployedBytecode.object,
  };

  const artifactPath = path.join(artifactsDir, 'MCTTokenSale.json');
  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));

  console.log('\n✅ Compilation successful!');
  console.log('📦 Artifact saved to:', artifactPath);
  console.log('📊 ABI size:', JSON.stringify(contract.abi).length, 'characters');
  console.log('💾 Bytecode size:', contract.evm.bytecode.object.length / 2, 'bytes');
  console.log('\n🎉 Contract is ready for deployment!');
  
} catch (error) {
  console.error('\n❌ Compilation failed:');
  console.error(error.message);
  process.exit(1);
}



