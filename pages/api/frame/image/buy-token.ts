// API endpoint для изображения Frame
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Возвращаем SVG изображение для Frame
  const svg = `
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <rect width="1200" height="630" fill="#8B5CF6"/>
      <rect x="50" y="50" width="1100" height="530" rx="20" fill="#FFFFFF"/>
      
      <text x="600" y="200" font-family="Arial, sans-serif" font-size="72" font-weight="bold" text-anchor="middle" fill="#1F2937">
        💎 Buy MCT Token
      </text>
      
      <text x="600" y="300" font-family="Arial, sans-serif" font-size="48" text-anchor="middle" fill="#4B5563">
        Purchase for $0.10 USD
      </text>
      
      <text x="600" y="400" font-family="Arial, sans-serif" font-size="36" text-anchor="middle" fill="#6B7280">
        Click button to buy with ETH or USDC
      </text>
      
      <rect x="200" y="450" width="350" height="80" rx="10" fill="#3B82F6"/>
      <text x="375" y="500" font-family="Arial, sans-serif" font-size="32" text-anchor="middle" fill="#FFFFFF">
        Buy with ETH
      </text>
      
      <rect x="650" y="450" width="350" height="80" rx="10" fill="#10B981"/>
      <text x="825" y="500" font-family="Arial, sans-serif" font-size="32" text-anchor="middle" fill="#FFFFFF">
        Buy with USDC
      </text>
    </svg>
  `;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).send(svg);
}



