# 🔧 Настройка контракта продажи токенов

## Вариант 1: Покупка через ETH

### Шаг 1: Развертывание контракта

Если у вас еще нет контракта, разверните `MrsCryptoTokenSale.sol`:

```solidity
// Используйте контракт из contracts/MrsCryptoTokenSale.sol
```

**Параметры конструктора:**
- `token_`: Адрес токена Mrs Crypto Token (`NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS`)
- `pricePerTokenWei`: Цена за 1 токен в wei (например, для 0.001 ETH = `1000000000000000`)

**Пример развертывания через Hardhat:**

```javascript
const hre = require("hardhat");

async function main() {
  const tokenAddress = "0x454b4180bc715ba6a8568a16f1f9a4b114a329a6";
  const pricePerToken = hre.ethers.parseEther("0.001"); // 0.001 ETH за 1 токен
  
  const TokenSale = await hre.ethers.getContractFactory("MrsCryptoTokenSale");
  const tokenSale = await TokenSale.deploy(tokenAddress, pricePerToken);
  
  await tokenSale.waitForDeployment();
  
  console.log("Token Sale deployed to:", await tokenSale.getAddress());
}
```

### Шаг 2: Настройка .env.local

```env
NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS=0x454b4180bc715ba6a8568a16f1f9a4b114a329a6
NEXT_PUBLIC_TOKEN_SALE_CONTRACT_ADDRESS=0xYourDeployedContractAddress
NEXT_PUBLIC_USE_USDC_FOR_PURCHASE=false
```

### Шаг 3: Пополнение контракта токенами

После развертывания нужно перевести токены на контракт продажи:

```javascript
// Перевести токены на контракт продажи
const token = await ethers.getContractAt("ERC20", tokenAddress);
await token.transfer(saleContractAddress, ethers.parseUnits("1000", 18)); // 1000 токенов
```

---

## Вариант 2: Покупка через USDC

### Шаг 1: Развертывание контракта

Разверните `MrsCryptoTokenSaleUSDC.sol`:

**Параметры конструктора:**
- `token_`: Адрес токена Mrs Crypto Token
- `paymentToken_`: Адрес USDC на Base (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- `pricePerTokenUSDC`: Цена за 1 токен в USDC (6 decimals, например, для 2.5 USDC = `2500000`)

**Пример развертывания:**

```javascript
const hre = require("hardhat");

async function main() {
  const tokenAddress = "0x454b4180bc715ba6a8568a16f1f9a4b114a329a6";
  const usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const pricePerToken = hre.ethers.parseUnits("2.5", 6); // 2.5 USDC за 1 токен
  
  const TokenSaleUSDC = await hre.ethers.getContractFactory("MrsCryptoTokenSaleUSDC");
  const tokenSaleUSDC = await TokenSaleUSDC.deploy(tokenAddress, usdcAddress, pricePerToken);
  
  await tokenSaleUSDC.waitForDeployment();
  
  console.log("Token Sale USDC deployed to:", await tokenSaleUSDC.getAddress());
}
```

### Шаг 2: Настройка .env.local

```env
NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS=0x454b4180bc715ba6a8568a16f1f9a4b114a329a6
NEXT_PUBLIC_TOKEN_SALE_USDC_CONTRACT_ADDRESS=0xYourDeployedContractAddress
NEXT_PUBLIC_USE_USDC_FOR_PURCHASE=true
NEXT_PUBLIC_USDC_CONTRACT_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

### Шаг 3: Пополнение контракта токенами

Аналогично варианту 1, переведите токены на контракт продажи.

---

## 🧪 Тестирование на Base Sepolia (тестовая сеть)

Для тестирования можно использовать тестовую сеть Base Sepolia:

1. Измените Chain ID в коде:
   - Base Sepolia: `84532` (hex: `0x14a34`)

2. Используйте тестовые адреса:
   - USDC на Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

3. Получите тестовые токены:
   - ETH: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
   - USDC: через тестовые мосты или faucets

---

## ✅ Проверка после развертывания

1. **Проверьте контракт на BaseScan:**
   ```
   https://basescan.org/address/YOUR_CONTRACT_ADDRESS
   ```

2. **Проверьте баланс токенов:**
   - Вызовите `availableTokens()` на контракте
   - Должен быть > 0 для продажи

3. **Проверьте цену:**
   - Вызовите `pricePerToken()` на контракте
   - Проверьте, что цена установлена правильно

4. **Тестируйте покупку:**
   - Запустите `npm run dev`
   - Откройте `/buyToken`
   - Попробуйте купить 0.10 MCT

---

## 📝 Примеры команд для проверки

```bash
# Проверка конфигурации
npm run check:config

# Тестирование логики
npm run test:token-purchase

# Запуск приложения
npm run dev
```

---

## 🆘 Решение проблем

**Проблема:** Контракт не развернут
- Решение: Разверните контракт на Base и скопируйте адрес

**Проблема:** Контракт не имеет токенов
- Решение: Переведите токены на адрес контракта продажи

**Проблема:** Неправильная цена
- Решение: Вызовите `setPricePerToken()` на контракте (только owner)

**Проблема:** Ошибка "Insufficient inventory"
- Решение: Пополните контракт токенами

