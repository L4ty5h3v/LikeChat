// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

/**
 * @title MCTTokenSale
 * @dev Простой контракт продажи токенов MCT за ETH или USDC
 * Покупаем токенов на $0.10 USD по рыночному курсу
 */
contract MCTTokenSale {
    IERC20 public immutable mctToken; // MCT Token: 0x04d388da70c32fc5876981097c536c51c8d3d236
    IERC20 public immutable usdcToken; // USDC на Base: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
    
    address public owner;
    uint256 public constant PURCHASE_AMOUNT_USD = 10; // $0.10 в центах (10 центов)
    
    // Цена токена в USDC (6 decimals для USDC)
    // 0.10 USDC за 0.10 MCT = 100000 (0.10 * 10^6)
    uint256 public pricePerTokenUSDC = 100000; // 0.10 USDC за 0.10 MCT
    
    // Цена токена в ETH (18 decimals)
    // Например: 0.0001 ETH за 0.10 MCT = 100000000000000 (0.0001 * 10^18)
    uint256 public pricePerTokenETH = 100000000000000; // 0.0001 ETH за 0.10 MCT
    
    event TokensPurchased(address indexed buyer, uint256 tokenAmount, uint256 paidAmount, bool isUSDC);
    
    constructor(address _mctToken, address _usdcToken) {
        mctToken = IERC20(_mctToken);
        usdcToken = IERC20(_usdcToken);
        owner = msg.sender;
    }
    
    /**
     * @dev Покупка токенов за ETH
     * @param tokenAmount Количество токенов MCT для покупки (в wei, 18 decimals)
     */
    function buyTokensWithETH(uint256 tokenAmount) external payable {
        require(tokenAmount > 0, "Token amount must be greater than 0");
        require(msg.value >= pricePerTokenETH, "Insufficient ETH sent");
        
        // Проверяем, что у контракта достаточно токенов
        require(mctToken.balanceOf(address(this)) >= tokenAmount, "Insufficient tokens in contract");
        
        // Переводим токены покупателю
        require(mctToken.transfer(msg.sender, tokenAmount), "Token transfer failed");
        
        // Возвращаем сдачу, если есть
        if (msg.value > pricePerTokenETH) {
            payable(msg.sender).transfer(msg.value - pricePerTokenETH);
        }
        
        emit TokensPurchased(msg.sender, tokenAmount, pricePerTokenETH, false);
    }
    
    /**
     * @dev Покупка токенов за USDC
     * @param tokenAmount Количество токенов MCT для покупки (в wei, 18 decimals)
     */
    function buyTokensWithUSDC(uint256 tokenAmount) external {
        require(tokenAmount > 0, "Token amount must be greater than 0");
        
        // Проверяем, что у контракта достаточно токенов
        require(mctToken.balanceOf(address(this)) >= tokenAmount, "Insufficient tokens in contract");
        
        // Проверяем allowance
        require(usdcToken.allowance(msg.sender, address(this)) >= pricePerTokenUSDC, "Insufficient USDC allowance");
        
        // Переводим USDC от покупателя в контракт
        require(usdcToken.transferFrom(msg.sender, address(this), pricePerTokenUSDC), "USDC transfer failed");
        
        // Переводим токены покупателю
        require(mctToken.transfer(msg.sender, tokenAmount), "Token transfer failed");
        
        emit TokensPurchased(msg.sender, tokenAmount, pricePerTokenUSDC, true);
    }
    
    /**
     * @dev Получить стоимость покупки в ETH
     */
    function getCostETH(uint256 tokenAmount) external view returns (uint256) {
        return pricePerTokenETH;
    }
    
    /**
     * @dev Получить стоимость покупки в USDC
     */
    function getCostUSDC(uint256 tokenAmount) external view returns (uint256) {
        return pricePerTokenUSDC;
    }
    
    /**
     * @dev Обновить цену (только owner)
     */
    function updatePriceUSDC(uint256 newPrice) external {
        require(msg.sender == owner, "Only owner");
        pricePerTokenUSDC = newPrice;
    }
    
    function updatePriceETH(uint256 newPrice) external {
        require(msg.sender == owner, "Only owner");
        pricePerTokenETH = newPrice;
    }
    
    /**
     * @dev Вывести средства (только owner)
     */
    function withdrawETH() external {
        require(msg.sender == owner, "Only owner");
        payable(owner).transfer(address(this).balance);
    }
    
    function withdrawUSDC() external {
        require(msg.sender == owner, "Only owner");
        usdcToken.transfer(owner, usdcToken.balanceOf(address(this)));
    }
    
    function withdrawMCT() external {
        require(msg.sender == owner, "Only owner");
        mctToken.transfer(owner, mctToken.balanceOf(address(this)));
    }
}



