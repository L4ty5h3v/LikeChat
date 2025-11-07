// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title Mrs Crypto Token Sale
/// @notice Simple custodial sale contract that forwards ERC20 tokens in exchange for ETH.
/// @dev Deploy the sale with the address of the Mrs Crypto token and the price per full token (1 * 10^decimals) in wei.
contract MrsCryptoTokenSale is Ownable {
    IERC20 public immutable token;
    uint8 public immutable tokenDecimals;

    /// @notice Price in wei for one whole token (taking token decimals into account).
    uint256 public pricePerToken;

    event TokensPurchased(address indexed buyer, uint256 tokenAmount, uint256 paidWei);
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);
    event TokensWithdrawn(address indexed to, uint256 amount);
    event EtherWithdrawn(address indexed to, uint256 amount);

    error InvalidAmount();
    error InsufficientPayment(uint256 requiredWei);
    error InsufficientInventory(uint256 availableTokens);

    constructor(IERC20 token_, uint256 pricePerTokenWei) Ownable(msg.sender) {
        token = token_;
        tokenDecimals = _getTokenDecimals(token_);
        pricePerToken = pricePerTokenWei;
    }

    /// @notice Purchase a specific amount of tokens.
    /// @param tokenAmount Amount of tokens to buy, expressed in token's smallest units (e.g. 1 token = 1e18 for 18 decimals).
    function buyTokens(uint256 tokenAmount) external payable {
        if (tokenAmount == 0) {
            revert InvalidAmount();
        }

        uint256 cost = _costFor(tokenAmount);
        if (msg.value < cost) {
            revert InsufficientPayment(cost);
        }

        uint256 available = token.balanceOf(address(this));
        if (available < tokenAmount) {
            revert InsufficientInventory(available);
        }

        token.transfer(msg.sender, tokenAmount);

        // Refund any excess ETH sent by mistake.
        if (msg.value > cost) {
            unchecked {
                (bool success, ) = msg.sender.call{value: msg.value - cost}("");
                require(success, "Refund failed");
            }
        }

        emit TokensPurchased(msg.sender, tokenAmount, cost);
    }

    /// @notice Update the sale price (wei per full token).
    function setPricePerToken(uint256 newPrice) external onlyOwner {
        uint256 old = pricePerToken;
        pricePerToken = newPrice;
        emit PriceUpdated(old, newPrice);
    }

    /// @notice Withdraw unsold tokens.
    function withdrawTokens(address to, uint256 amount) external onlyOwner {
        token.transfer(to, amount);
        emit TokensWithdrawn(to, amount);
    }

    /// @notice Withdraw collected ETH.
    function withdrawEther(address payable to, uint256 amount) external onlyOwner {
        to.transfer(amount);
        emit EtherWithdrawn(to, amount);
    }

    /// @notice Helper: cost in wei for desired amount of tokens.
    function costFor(uint256 tokenAmount) external view returns (uint256) {
        return _costFor(tokenAmount);
    }

    /// @notice Returns the amount of tokens still held by the sale contract.
    function availableTokens() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function _costFor(uint256 tokenAmount) internal view returns (uint256) {
        // pricePerToken is set for one full token (10^decimals units).
        uint256 unit = 10 ** uint256(tokenDecimals);
        return (pricePerToken * tokenAmount) / unit;
    }

    function _getTokenDecimals(IERC20 token_) private view returns (uint8) {
        (bool success, bytes memory data) = address(token_).staticcall(abi.encodeWithSignature("decimals()"));
        require(success && data.length >= 32, "Token decimals query failed");
        return uint8(uint256(bytes32(data)));
    }
}


