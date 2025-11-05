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
        
        // Пробуем разные варианты endpoint
        let user = null;
        
        // Вариант 1: /farcaster/user/by_verification
        try {
          const response1 = await axios.get(`${NEYNAR_BASE_URL}/farcaster/user/by_verification`, {
            params: {
              address: walletAddress,
            },
            headers: {
              'api_key': NEYNAR_API_KEY,
            },
          });
          
          user = response1.data.result?.user || response1.data.user || response1.data;
          console.log('✅ Response from by_verification:', response1.data);
        } catch (error1: any) {
          console.log('⚠️ by_verification failed, trying alternative:', error1?.response?.data || error1?.message);
          
          // Вариант 2: /farcaster/user/search (если доступен)
          try {
            const response2 = await axios.get(`${NEYNAR_BASE_URL}/farcaster/user/search`, {
              params: {
                q: walletAddress,
              },
              headers: {
                'api_key': NEYNAR_API_KEY,
              },
            });
            
            user = response2.data.result?.users?.[0] || response2.data.users?.[0];
            console.log('✅ Response from search:', response2.data);
          } catch (error2: any) {
            console.log('⚠️ search also failed:', error2?.response?.data || error2?.message);
          }
        }
        
        if (user && user.fid) {
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
        console.error('❌ Error fetching user by address:', {
          status: error?.response?.status,
          data: error?.response?.data,
          message: error?.message,
        });
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

