// API endpoint для транзакции покупки за USDC (EIP-5792 walletsendCalls с батчем approve + buyTokens)
import type { NextApiRequest, NextApiResponse } from 'next';
import { ethers } from 'ethers';

// ВАЖНО: После развертывания контракта обновите этот адрес!
const TOKEN_SALE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_SALE_CONTRACT_ADDRESS || '';
const TOKEN_CONTRACT_ADDRESS = '0x04d388da70c32fc5876981097c536c51c8d3d236'; // MCT Token
const USDC_CONTRACT_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC на Base
const BASE_CHAIN_ID = 8453;
const TOKEN_AMOUNT = '100000000000000000'; // 0.10 MCT (18 decimals)
const PRICE_USDC = '250000'; // 0.25 USDC (6 decimals)

// ABI для контракта продажи
const TOKEN_SALE_ABI = [
  'function buyTokensWithUSDC(uint256 tokenAmount)',
  'function getCostUSDC(uint256 tokenAmount) view returns (uint256)',
];

// ABI для USDC (ERC20)
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { trustedData } = req.body;
    
    if (!TOKEN_SALE_CONTRACT_ADDRESS) {
      return res.status(500).json({
        error: 'Token sale contract not deployed',
        message: 'Please deploy the contract first and set TOKEN_SALE_CONTRACT_ADDRESS',
      });
    }

    // Создаем интерфейсы контрактов
    const saleIface = new ethers.Interface(TOKEN_SALE_ABI);
    const usdcIface = new ethers.Interface(ERC20_ABI);

    // Формируем данные для транзакций
    const tokenAmount = ethers.parseEther('0.10'); // 0.10 MCT
    
    // 1. Approve USDC для контракта продажи
    const approveData = usdcIface.encodeFunctionData('approve', [
      TOKEN_SALE_CONTRACT_ADDRESS,
      ethers.parseUnits(PRICE_USDC, 6), // 0.25 USDC (6 decimals)
    ]);

    // 2. Buy tokens with USDC
    const buyData = saleIface.encodeFunctionData('buyTokensWithUSDC', [tokenAmount]);

    // Формируем батч транзакций для EIP-5792 walletsendCalls
    // Батч: approve + buyTokensWithUSDC
    const calls = [
      {
        to: USDC_CONTRACT_ADDRESS,
        value: '0',
        data: approveData,
      },
      {
        to: TOKEN_SALE_CONTRACT_ADDRESS,
        value: '0',
        data: buyData,
      },
    ];

    // Возвращаем ответ для Farcaster Frame с батчем транзакций
    return res.status(200).json({
      chainId: `eip155:${BASE_CHAIN_ID}`,
      method: 'wallet_sendCalls', // EIP-5792
      params: {
        version: '1.0',
        chainId: `eip155:${BASE_CHAIN_ID}`,
        calls: calls,
      },
    });
  } catch (error: any) {
    console.error('Error generating transaction:', error);
    return res.status(500).json({
      error: 'Failed to generate transaction',
      message: error.message,
    });
  }
}

