// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title Mrs Crypto Token Sale (USDC)
/// @notice Simple custodial sale contract that forwards ERC20 tokens in exchange for USDC.
/// @dev Deploy the sale with the address of the Mrs Crypto token, USDC token, and the price per full token (1 * 10^decimals) in USDC (6 decimals).
contract MrsCryptoTokenSaleUSDC is Ownable {
    IERC20 public immutable token; // Mrs Crypto Token
    IERC20 public immutable paymentToken; // USDC
    uint8 public immutable tokenDecimals;
    uint8 public immutable paymentTokenDecimals;

    /// @notice Price in USDC (6 decimals) for one whole token (taking token decimals into account).
    uint256 public pricePerToken;

    event TokensPurchased(address indexed buyer, uint256 tokenAmount, uint256 paidUSDC);
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);
    event TokensWithdrawn(address indexed to, uint256 amount);
    event USDCWithdrawn(address indexed to, uint256 amount);

    error InvalidAmount();
    error InsufficientPayment(uint256 requiredUSDC);
    error InsufficientInventory(uint256 availableTokens);
    error InsufficientAllowance(uint256 required, uint256 current);

    constructor(
        IERC20 token_,
        IERC20 paymentToken_,
        uint256 pricePerTokenUSDC
    ) Ownable(msg.sender) {
        token = token_;
        paymentToken = paymentToken_;
        tokenDecimals = _getTokenDecimals(token_);
        paymentTokenDecimals = _getTokenDecimals(paymentToken_);
        pricePerToken = pricePerTokenUSDC;
    }

    /// @notice Purchase a specific amount of tokens using USDC.
    /// @param tokenAmount Amount of tokens to buy, expressed in token's smallest units (e.g. 1 token = 1e18 for 18 decimals).
    function buyTokens(uint256 tokenAmount) external {
        if (tokenAmount == 0) {
            revert InvalidAmount();
        }

        uint256 cost = _costFor(tokenAmount);
        
        // Check allowance
        uint256 allowance = paymentToken.allowance(msg.sender, address(this));
        if (allowance < cost) {
            revert InsufficientAllowance(cost, allowance);
        }

        uint256 available = token.balanceOf(address(this));
        if (available < tokenAmount) {
            revert InsufficientInventory(available);
        }

        // Transfer USDC from buyer to contract
        bool success = paymentToken.transferFrom(msg.sender, address(this), cost);
        require(success, "USDC transfer failed");

        // Transfer tokens to buyer
        success = token.transfer(msg.sender, tokenAmount);
        require(success, "Token transfer failed");

        emit TokensPurchased(msg.sender, tokenAmount, cost);
    }

    /// @notice Update the sale price (USDC per full token).
    function setPricePerToken(uint256 newPrice) external onlyOwner {
        uint256 old = pricePerToken;
        pricePerToken = newPrice;
        emit PriceUpdated(old, newPrice);
    }

    /// @notice Withdraw unsold tokens.
    function withdrawTokens(address to, uint256 amount) external onlyOwner {
        bool success = token.transfer(to, amount);
        require(success, "Token withdrawal failed");
        emit TokensWithdrawn(to, amount);
    }

    /// @notice Withdraw collected USDC.
    function withdrawUSDC(address to, uint256 amount) external onlyOwner {
        bool success = paymentToken.transfer(to, amount);
        require(success, "USDC withdrawal failed");
        emit USDCWithdrawn(to, amount);
    }

    /// @notice Helper: cost in USDC for desired amount of tokens.
    function costFor(uint256 tokenAmount) external view returns (uint256) {
        return _costFor(tokenAmount);
    }

    /// @notice Returns the amount of tokens still held by the sale contract.
    function availableTokens() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function _costFor(uint256 tokenAmount) internal view returns (uint256) {
        // pricePerToken is set for one full token (10^tokenDecimals units).
        // pricePerToken is in USDC (6 decimals).
        uint256 unit = 10 ** uint256(tokenDecimals);
        return (pricePerToken * tokenAmount) / unit;
    }

    function _getTokenDecimals(IERC20 token_) private view returns (uint8) {
        (bool success, bytes memory data) = address(token_).staticcall(
            abi.encodeWithSignature("decimals()")
        );
        require(success && data.length >= 32, "Token decimals query failed");
        return uint8(uint256(bytes32(data)));
    }
}

