// Frame страница для покупки токенов через Farcaster Frame
'use client';

import { useState } from 'react';

// ВАЖНО: После развертывания контракта обновите этот адрес!
const TOKEN_SALE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_SALE_CONTRACT_ADDRESS || '';
const TOKEN_CONTRACT_ADDRESS = '0x04d388da70c32fc5876981097c536c51c8d3d236'; // MCT Token
const USDC_CONTRACT_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC на Base

export default function BuyTokenFrame() {
  const [purchased, setPurchased] = useState(false);
  const [error, setError] = useState<string>('');

  return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
            <h1 className="text-3xl font-bold text-center mb-2">
              💎 Buy MCT Token
            </h1>
            <p className="text-center text-gray-600 mb-6">
              Purchase MCT tokens for $0.10 USD
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
                <p className="text-green-600 mt-2">
                  Check your wallet for MCT tokens
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-center text-gray-600">
                  Use the Frame API endpoint to purchase tokens
                </p>
                <a 
                  href="/api/frame/buy-token"
                  className="block w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-xl text-center transition-colors"
                >
                  Open Frame
                </a>
              </div>
            )}

            <div className="mt-6 text-sm text-gray-500 text-center">
              <p>Token: {TOKEN_CONTRACT_ADDRESS}</p>
              <p>Price: $0.10 USD</p>
            </div>
          </div>
        </div>
  );
}

