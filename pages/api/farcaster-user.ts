// API endpoint для получения данных пользователя Farcaster по адресу кошелька
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const NEYNAR_API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY || '';
const NEYNAR_BASE_URL = 'https://api.neynar.com/v2';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletAddress, fid } = req.body;

    if (!NEYNAR_API_KEY) {
      return res.status(200).json({ 
        user: null,
        warning: 'Neynar API key not configured'
      });
    }

    // Если передан адрес кошелька, ищем пользователя по адресу
    if (walletAddress) {
      try {
        console.log(`🔍 Looking for Farcaster user by address: ${walletAddress}`);
        const response = await axios.get(`${NEYNAR_BASE_URL}/farcaster/user/by_verification`, {
          params: {
            address: walletAddress,
          },
          headers: {
            'api_key': NEYNAR_API_KEY,
          },
        });

        const user = response.data.result?.user || response.data.user;
        if (user) {
          return res.status(200).json({
            user: {
              fid: user.fid,
              username: user.username,
              pfp_url: user.pfp?.url || user.pfp_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.fid}`,
              display_name: user.display_name || user.username,
            }
          });
        }
      } catch (error: any) {
        console.error('❌ Error fetching user by address:', error?.response?.data || error?.message);
        // Продолжаем, если не нашли по адресу
      }
    }

    // Если передан FID, получаем данные по FID
    if (fid) {
      try {
        console.log(`🔍 Fetching Farcaster user by FID: ${fid}`);
        const response = await axios.get(`${NEYNAR_BASE_URL}/farcaster/user/bulk`, {
          params: {
            fids: fid,
          },
          headers: {
            'api_key': NEYNAR_API_KEY,
          },
        });

        const user = response.data.users?.[0];
        if (user) {
          return res.status(200).json({
            user: {
              fid: user.fid,
              username: user.username,
              pfp_url: user.pfp?.url || user.pfp_url || user.pfp || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.fid}`,
              display_name: user.display_name || user.username,
            }
          });
        }
      } catch (error: any) {
        console.error('❌ Error fetching user by FID:', error?.response?.data || error?.message);
      }
    }

    return res.status(200).json({ user: null });
  } catch (error: any) {
    console.error('Error in farcaster-user API:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch Farcaster user',
      message: error.message || 'Unknown error'
    });
  }
}

