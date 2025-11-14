// API endpoint для Farcaster Frame - покупка токена
import type { NextApiRequest, NextApiResponse } from 'next';

// Константы контракта
// ВАЖНО: После развертывания контракта обновите этот адрес!
const TOKEN_SALE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_SALE_CONTRACT_ADDRESS || '';
const TOKEN_CONTRACT_ADDRESS = '0x04d388da70c32fc5876981097c536c51c8d3d236'; // MCT Token
const USDC_CONTRACT_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC на Base
const BASE_CHAIN_ID = 8453;

// Frame метаданные для Farcaster
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // GET запрос - возвращаем метаданные frame
  if (req.method === 'GET') {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://likechat-farcaster.vercel.app';
    const imageUrl = `${baseUrl}/api/frame/image/buy-token`;
    const ethTxUrl = `${baseUrl}/api/frame/tx/eth`;
    const usdcTxUrl = `${baseUrl}/api/frame/tx/usdc`;

    // Возвращаем HTML с правильными Open Graph метаданными для Farcaster Frame
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta property="og:title" content="Buy MCT Token" />
          <meta property="og:description" content="Purchase MCT tokens for $0.10 USD" />
          <meta property="og:image" content="${imageUrl}" />
          
          <!-- Farcaster Frame метаданные -->
          <meta property="fc:frame" content="vNext" />
          <meta property="fc:frame:image" content="${imageUrl}" />
          <meta property="fc:frame:button:1" content="Buy MCT with ETH" />
          <meta property="fc:frame:button:1:action" content="tx" />
          <meta property="fc:frame:button:1:target" content="${ethTxUrl}" />
          <meta property="fc:frame:button:2" content="Buy MCT with USDC" />
          <meta property="fc:frame:button:2:action" content="tx" />
          <meta property="fc:frame:button:2:target" content="${usdcTxUrl}" />
          
          <title>Buy MCT Token</title>
        </head>
        <body>
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui;">
            <h1>💎 Buy MCT Token</h1>
            <p>Purchase MCT tokens for $0.10 USD</p>
            ${!TOKEN_SALE_CONTRACT_ADDRESS ? '<p style="color: red; margin-top: 20px;">⚠️ Contract not deployed yet</p>' : ''}
          </div>
        </body>
      </html>
    `;

    return res.status(200).setHeader('Content-Type', 'text/html').send(html);
  }

  // POST запрос - обработка транзакции (не используется для tx action)
  return res.status(200).json({ message: 'Transaction processed' });
}

