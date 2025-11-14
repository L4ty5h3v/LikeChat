// Альтернативная страница покупки через walletsendCalls (EIP-5792) без onchainkit
'use client';

import { useState } from 'react';
import { buyTokensWithETHViaFrame, buyTokensWithUSDCViaFrame, executeWalletSendCalls } from '@/lib/farcaster-frame-purchase';

// ВАЖНО: После развертывания контракта обновите этот адрес!
const TOKEN_SALE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_SALE_CONTRACT_ADDRESS || '';

export default function BuyTokenFramePage() {
  const [loading, setLoading] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const [error, setError] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');

  const handleBuyWithETH = async () => {
    setLoading(true);
    setError('');

    try {
      // Получаем адрес пользователя (можно через Farcaster SDK)
      const userAddress = ''; // Получить из Farcaster SDK

      // Подготавливаем транзакции
      const result = await buyTokensWithETHViaFrame(userAddress);

      if (!result.success || !result.calls) {
        throw new Error(result.error || 'Failed to prepare transaction');
      }

      // Выполняем walletsendCalls
      const txResult = await executeWalletSendCalls(result.calls, 'ETH');

      if (!txResult.success) {
        throw new Error(txResult.error || 'Transaction failed');
      }

      setTxHash(txResult.txHash || '');
      setPurchased(true);
    } catch (err: any) {
      setError(err.message || 'Purchase failed');
    } finally {
      setLoading(false);
    }
  };

  const handleBuyWithUSDC = async () => {
    setLoading(true);
    setError('');

    try {
      // Получаем адрес пользователя (можно через Farcaster SDK)
      const userAddress = ''; // Получить из Farcaster SDK

      // Подготавливаем транзакции (батч: approve + buyTokens)
      const result = await buyTokensWithUSDCViaFrame(userAddress);

      if (!result.success || !result.calls) {
        throw new Error(result.error || 'Failed to prepare transaction');
      }

      // Выполняем walletsendCalls
      const txResult = await executeWalletSendCalls(result.calls, 'USDC');

      if (!txResult.success) {
        throw new Error(txResult.error || 'Transaction failed');
      }

      setTxHash(txResult.txHash || '');
      setPurchased(true);
    } catch (err: any) {
      setError(err.message || 'Purchase failed');
    } finally {
      setLoading(false);
    }
  };

  if (!TOKEN_SALE_CONTRACT_ADDRESS) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-2xl font-bold text-center mb-4 text-red-600">
            ⚠️ Contract Not Deployed
          </h1>
          <p className="text-center text-gray-600">
            Please deploy the MCTTokenSale contract first and set TOKEN_SALE_CONTRACT_ADDRESS
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center mb-2">
          💎 Buy MCT Token
        </h1>
        <p className="text-center text-gray-600 mb-6">
          Purchase MCT tokens for $0.10 USD using EIP-5792 walletsendCalls
        </p>

        {error && (
          <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 mb-6">
            <p className="text-red-800 font-semibold">{error}</p>
          </div>
        )}

        {purchased ? (
          <div className="bg-green-50 border-2 border-green-300 rounded-xl p-6 text-center">
            <p className="text-green-800 font-semibold text-lg">
              ✅ Tokens purchased successfully!
            </p>
            {txHash && (
              <p className="text-green-600 mt-2 text-sm">
                Transaction: {txHash}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <button
              onClick={handleBuyWithETH}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Buy MCT with ETH ($0.10)'}
            </button>

            <button
              onClick={handleBuyWithUSDC}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Buy MCT with USDC ($0.10)'}
            </button>
          </div>
        )}

        <div className="mt-6 text-sm text-gray-500 text-center">
          <p>Using EIP-5792 walletsendCalls for batch transactions</p>
          <p className="mt-2">USDC purchase includes: approve + buyTokens</p>
        </div>
      </div>
    </div>
  );
}

