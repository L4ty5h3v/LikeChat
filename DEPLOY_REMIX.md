# 🚀 Развертывание контракта через Remix IDE

Самый простой способ развернуть контракт без настройки Hardhat.

## 📋 Шаг 1: Откройте Remix IDE

Перейдите на https://remix.ethereum.org

## 📋 Шаг 2: Создайте файл контракта

1. В левой панели создайте файл `MrsCryptoTokenSale.sol`
2. Скопируйте содержимое из `contracts/MrsCryptoTokenSale.sol` в Remix

## 📋 Шаг 3: Установите зависимости

В Remix нужно установить OpenZeppelin контракты:

1. Откройте вкладку "File Explorer"
2. Создайте папку `@openzeppelin`
3. Внутри создайте папку `contracts`
4. Создайте файл `@openzeppelin/contracts/token/ERC20/IERC20.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
}
```

5. Создайте файл `@openzeppelin/contracts/access/Ownable.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

abstract contract Ownable {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address initialOwner) {
        _owner = initialOwner;
    }

    function owner() public view virtual returns (address) {
        return _owner;
    }

    modifier onlyOwner() {
        require(owner() == msg.sender, "Ownable: caller is not the owner");
        _;
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}
```

## 📋 Шаг 4: Скомпилируйте контракт

1. Откройте вкладку "Solidity Compiler"
2. Выберите версию компилятора: **0.8.20**
3. Нажмите "Compile MrsCryptoTokenSale.sol"
4. Убедитесь, что нет ошибок

## 📋 Шаг 5: Подключите кошелек

1. Откройте вкладку "Deploy & Run Transactions"
2. Выберите "Injected Provider - MetaMask" (или другой кошелек)
3. Убедитесь, что вы подключены к сети **Base**
4. Если Base нет в списке, добавьте:
   - Network Name: Base
   - RPC URL: https://mainnet.base.org
   - Chain ID: 8453
   - Currency Symbol: ETH

## 📋 Шаг 6: Разверните контракт

1. В разделе "Deploy" найдите `MRS_CRYPTO_TOKEN_SALE`
2. В поле конструктора введите параметры:

**Параметр 1 (token_):**
```
0x04d388da70c32fc5876981097c536c51c8d3d236
```

**Параметр 2 (pricePerTokenWei):**
```
1000000000000000
```
(Это 0.001 ETH в wei, что означает 0.001 ETH за 1 токен, или 0.0001 ETH за 0.10 MCT)

3. Нажмите "Deploy"
4. Подтвердите транзакцию в кошельке

## 📋 Шаг 7: Сохраните адрес контракта

После развертывания:

1. Скопируйте адрес развернутого контракта
2. Добавьте в `.env.local`:

```env
NEXT_PUBLIC_TOKEN_SALE_CONTRACT_ADDRESS=0xВашАдресКонтракта
NEXT_PUBLIC_USE_USDC_FOR_PURCHASE=false
```

## 📋 Шаг 8: Проверьте контракт

1. Откройте контракт на BaseScan:
   ```
   https://basescan.org/address/YOUR_CONTRACT_ADDRESS
   ```

2. Проверьте цену:
   - Вызовите `pricePerToken()` - должно вернуть `1000000000000000` (0.001 ETH)

3. Проверьте стоимость 0.10 MCT:
   - Вызовите `costFor(100000000000000000)` - должно вернуть `100000000000000` (0.0001 ETH)

## 📋 Шаг 9: Пополните контракт токенами

1. Откройте ваш кошелек
2. Найдите токен Mrs Crypto Token
3. Переведите токены на адрес контракта продажи
4. Минимальное количество: 10-100 MCT для тестирования

## ✅ Готово!

Теперь можно тестировать покупку токена в приложении!

---

## 🔄 Для USDC контракта

Если хотите развернуть контракт для USDC:

1. Используйте `contracts/MrsCryptoTokenSaleUSDC.sol`
2. Параметры конструктора:
   - `token_`: `0x04d388da70c32fc5876981097c536c51c8d3d236`
   - `paymentToken_`: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (USDC на Base)
   - `pricePerTokenUSDC`: `2500000` (2.5 USDC в 6 decimals)

3. После развертывания добавьте в `.env.local`:
```env
NEXT_PUBLIC_TOKEN_SALE_USDC_CONTRACT_ADDRESS=0xВашАдресКонтракта
NEXT_PUBLIC_USE_USDC_FOR_PURCHASE=true
NEXT_PUBLIC_USDC_CONTRACT_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

