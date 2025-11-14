# Развертывание контракта MCTTokenSale

## Шаги для развертывания

### 1. Используйте Remix IDE (рекомендуется)

1. Откройте [Remix IDE](https://remix.ethereum.org/)
2. Создайте новый файл `MCTTokenSale.sol` в папке `contracts`
3. Скопируйте содержимое из `contracts/MCTTokenSale.sol`
4. Выберите компилятор Solidity 0.8.20 или выше
5. Скомпилируйте контракт
6. Перейдите на вкладку "Deploy & Run Transactions"
7. Выберите "Injected Provider - MetaMask" (или Farcaster Wallet)
8. Убедитесь, что вы в сети Base (Chain ID: 8453)
9. Введите параметры конструктора:
   - `_mctToken`: `0x04d388da70c32fc5876981097c536c51c8d3d236`
   - `_usdcToken`: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
10. Нажмите "Deploy"
11. Скопируйте адрес развернутого контракта

### 2. Пополните контракт токенами MCT

После развертывания контракта нужно перевести токены MCT на адрес контракта:

1. Откройте ваш кошелек (Farcaster Wallet или MetaMask)
2. Перейдите на [BaseScan](https://basescan.org/)
3. Найдите токен MCT: `0x04d388da70c32fc5876981097c536c51c8d3d236`
4. Переведите необходимое количество токенов MCT на адрес контракта продажи

### 3. Обновите адрес контракта в коде

После развертывания обновите адрес контракта в следующих файлах:

1. `pages/api/frame/tx/eth.ts` - строка с `TOKEN_SALE_CONTRACT_ADDRESS`
2. `pages/api/frame/tx/usdc.ts` - строка с `TOKEN_SALE_CONTRACT_ADDRESS`
3. `lib/farcaster-frame-purchase.ts` - строка с `TOKEN_SALE_CONTRACT_ADDRESS`
4. `pages/buy-token-frame.tsx` - строка с `TOKEN_SALE_CONTRACT_ADDRESS`
5. `pages/frame/buy-token.tsx` - строка с `TOKEN_SALE_CONTRACT_ADDRESS`

### 4. Настройте цены (опционально)

Если нужно изменить цены, вызовите функции контракта:
- `updatePriceETH(uint256 newPrice)` - для обновления цены в ETH
- `updatePriceUSDC(uint256 newPrice)` - для обновления цены в USDC

Только owner контракта может вызывать эти функции.

## Использование

После развертывания контракта:

1. Frame будет доступен по адресу: `/api/frame/buy-token`
2. Пользователи могут покупать токены через Farcaster Frame
3. Для USDC используется батч транзакций (approve + buyTokens) через EIP-5792 walletsendCalls
4. Для ETH используется одна транзакция (buyTokensWithETH)

## Проверка работы

1. Откройте Frame в Farcaster/Warpcast
2. Нажмите кнопку "Buy MCT with ETH" или "Buy MCT with USDC"
3. Подтвердите транзакцию в кошельке
4. Проверьте баланс токенов MCT в кошельке



