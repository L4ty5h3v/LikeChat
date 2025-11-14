// API endpoint для транзакции покупки за ETH (EIP-5792 walletsendCalls)
import type { NextApiRequest, NextApiResponse } from 'next';
import { ethers } from 'ethers';

// ВАЖНО: После развертывания контракта обновите этот адрес!
const TOKEN_SALE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_SALE_CONTRACT_ADDRESS || '';
const TOKEN_CONTRACT_ADDRESS = '0x04d388da70c32fc5876981097c536c51c8d3d236'; // MCT Token
const BASE_CHAIN_ID = 8453;
const TOKEN_AMOUNT = '100000000000000000'; // 0.10 MCT (18 decimals)
const PRICE_ETH = '100000000000000'; // 0.0001 ETH (18 decimals)

// ABI для контракта продажи
const TOKEN_SALE_ABI = [
  'function buyTokensWithETH(uint256 tokenAmount) payable',
  'function getCostETH(uint256 tokenAmount) view returns (uint256)',
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

    // Создаем интерфейс контракта
    const iface = new ethers.Interface(TOKEN_SALE_ABI);
    
    // Формируем данные для транзакции
    const tokenAmount = ethers.parseEther('0.10'); // 0.10 MCT
    const callData = iface.encodeFunctionData('buyTokensWithETH', [tokenAmount]);

    // Формируем батч транзакций для EIP-5792 walletsendCalls
    // В данном случае одна транзакция (buyTokensWithETH уже принимает ETH)
    const calls = [
      {
        to: TOKEN_SALE_CONTRACT_ADDRESS,
        value: PRICE_ETH, // 0.0001 ETH
        data: callData,
      },
    ];

    // Возвращаем ответ для Farcaster Frame с транзакцией
    // Farcaster Frame ожидает специфический формат для tx action
    return res.status(200).json({
      chainId: `eip155:${BASE_CHAIN_ID}`,
      method: 'eth_sendTransaction',
      params: {
        abi: TOKEN_SALE_ABI,
        to: TOKEN_SALE_CONTRACT_ADDRESS,
        value: PRICE_ETH,
        data: callData,
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

