# Смарт-контракт токена Миссис Крипто

## Обзор

Простой смарт-контракт для покупки токена MRS (Миссис Крипто) за ETH.

## Пример контракта (Solidity)

\`\`\`solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MrsCryptoToken is ERC20, Ownable {
    // Цена токена в wei (0.1$ ~ 0.00004 ETH при цене ETH $2500)
    uint256 public tokenPrice = 0.00004 ether;
    
    // Количество токенов за покупку
    uint256 public tokensPerPurchase = 1 ether; // 1 токен (с 18 decimals)
    
    constructor() ERC20("Mrs Crypto Token", "MRS") {
        // Минт начального запаса
        _mint(address(this), 1000000 * 10**decimals());
    }
    
    /**
     * @dev Покупка токена за ETH
     */
    function buy() external payable {
        require(msg.value >= tokenPrice, "Insufficient payment");
        require(balanceOf(address(this)) >= tokensPerPurchase, "Not enough tokens");
        
        // Перевод токенов покупателю
        _transfer(address(this), msg.sender, tokensPerPurchase);
        
        // Вернуть излишек
        if (msg.value > tokenPrice) {
            payable(msg.sender).transfer(msg.value - tokenPrice);
        }
        
        emit TokenPurchased(msg.sender, tokensPerPurchase, msg.value);
    }
    
    /**
     * @dev Получить текущую цену токена
     */
    function getPrice() external view returns (uint256) {
        return tokenPrice;
    }
    
    /**
     * @dev Обновить цену токена (только владелец)
     */
    function setTokenPrice(uint256 newPrice) external onlyOwner {
        tokenPrice = newPrice;
    }
    
    /**
     * @dev Обновить количество токенов за покупку (только владелец)
     */
    function setTokensPerPurchase(uint256 amount) external onlyOwner {
        tokensPerPurchase = amount;
    }
    
    /**
     * @dev Вывод средств (только владелец)
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        payable(owner()).transfer(balance);
    }
    
    /**
     * @dev Минт дополнительных токенов (только владелец)
     */
    function mint(uint256 amount) external onlyOwner {
        _mint(address(this), amount);
    }
    
    // События
    event TokenPurchased(address indexed buyer, uint256 amount, uint256 price);
}
\`\`\`

## Развертывание

### 1. Подготовка

\`\`\`bash
npm install --save-dev hardhat @openzeppelin/contracts
npx hardhat init
\`\`\`

### 2. Скрипт развертывания

\`\`\`javascript
// scripts/deploy.js
const hre = require("hardhat");

async function main() {
  const MrsCryptoToken = await hre.ethers.getContractFactory("MrsCryptoToken");
  const token = await MrsCryptoToken.deploy();

  await token.deployed();

  console.log("MrsCryptoToken deployed to:", token.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
\`\`\`

### 3. Развертывание на Base

\`\`\`bash
npx hardhat run scripts/deploy.js --network base
\`\`\`

### 4. Верификация контракта

\`\`\`bash
npx hardhat verify --network base DEPLOYED_CONTRACT_ADDRESS
\`\`\`

## Настройка в приложении

После развертывания обновите \`.env.local\`:

\`\`\`env
NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS=0xYourContractAddress
NEXT_PUBLIC_CHAIN_ID=8453
NEXT_PUBLIC_TOKEN_PRICE_USD=0.1
\`\`\`

## Тестирование контракта

\`\`\`javascript
// test/MrsCryptoToken.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MrsCryptoToken", function () {
  let token;
  let owner;
  let buyer;

  beforeEach(async function () {
    [owner, buyer] = await ethers.getSigners();
    const MrsCryptoToken = await ethers.getContractFactory("MrsCryptoToken");
    token = await MrsCryptoToken.deploy();
    await token.deployed();
  });

  it("Should allow buying tokens", async function () {
    const price = await token.tokenPrice();
    await token.connect(buyer).buy({ value: price });
    
    const balance = await token.balanceOf(buyer.address);
    expect(balance).to.be.gt(0);
  });

  it("Should revert if payment is insufficient", async function () {
    await expect(
      token.connect(buyer).buy({ value: ethers.utils.parseEther("0.00001") })
    ).to.be.revertedWith("Insufficient payment");
  });
});
\`\`\`

## Альтернатива: Использование существующего DEX

Вместо развертывания собственного контракта можно использовать:

- **Uniswap V3** на Base
- **SushiSwap** на Base
- **Aerodrome** (нативный DEX Base)

### Пример интеграции с Uniswap:

\`\`\`typescript
import { ethers } from 'ethers';

// Адрес Uniswap Router на Base
const UNISWAP_ROUTER = '0x...';

async function buyTokenViaUniswap(tokenAddress: string, amountIn: string) {
  const router = new ethers.Contract(UNISWAP_ROUTER, ROUTER_ABI, signer);
  
  const path = [WETH_ADDRESS, tokenAddress];
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 минут
  
  const tx = await router.swapExactETHForTokens(
    0, // amountOutMin
    path,
    userAddress,
    deadline,
    { value: ethers.parseEther(amountIn) }
  );
  
  await tx.wait();
}
\`\`\`

## Безопасность

⚠️ **Важные моменты:**

1. Аудит контракта перед продакшеном
2. Тестирование на testnet (Base Sepolia)
3. Установка лимитов на покупку
4. Защита от reentrancy атак
5. Мультисиг для управления контрактом

## Полезные ссылки

- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Base Network Docs](https://docs.base.org/)
- [Ethers.js v6](https://docs.ethers.org/v6/)

---

Это базовая реализация. В продакшене рекомендуется использовать более сложную логику с проверками и защитой.

