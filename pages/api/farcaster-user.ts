// API endpoint для получения данных пользователя Farcaster по адресу кошелька
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

// Используем серверную переменную окружения (не NEXT_PUBLIC_*)
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || '';
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
        
        // Нормализуем адрес (убираем префикс 0x если есть, делаем lowercase)
        const normalizedAddress = walletAddress.toLowerCase().startsWith('0x') 
          ? walletAddress.toLowerCase() 
          : `0x${walletAddress.toLowerCase()}`;
        
        console.log(`📍 Normalized address: ${normalizedAddress}`);
        
        // Пробуем разные варианты endpoint
        let user = null;
        
        // Вариант 1: /farcaster/user/by_verification
        try {
          console.log('🔍 Trying by_verification endpoint...');
          const response1 = await axios.get(`${NEYNAR_BASE_URL}/farcaster/user/by_verification`, {
            params: {
              address: normalizedAddress,
            },
            headers: {
              'api_key': NEYNAR_API_KEY,
            },
          });
          
          console.log('📊 by_verification response status:', response1.status);
          console.log('📊 by_verification response data:', JSON.stringify(response1.data, null, 2));
          
          user = response1.data.result?.user || response1.data.user || response1.data;
          
          if (user && user.fid) {
            console.log('✅ User found via by_verification:', {
              fid: user.fid,
              username: user.username,
              hasPfp: !!user.pfp,
            });
          }
        } catch (error1: any) {
          console.error('❌ by_verification failed:', {
            status: error1?.response?.status,
            statusText: error1?.response?.statusText,
            data: error1?.response?.data,
            message: error1?.message,
          });
          
          // Вариант 2: /farcaster/user/search (если доступен)
          try {
            console.log('🔍 Trying search endpoint...');
            const response2 = await axios.get(`${NEYNAR_BASE_URL}/farcaster/user/search`, {
              params: {
                q: normalizedAddress,
              },
              headers: {
                'api_key': NEYNAR_API_KEY,
              },
            });
            
            console.log('📊 search response data:', JSON.stringify(response2.data, null, 2));
            
            user = response2.data.result?.users?.[0] || response2.data.users?.[0];
            
            if (user && user.fid) {
              console.log('✅ User found via search:', {
                fid: user.fid,
                username: user.username,
              });
            }
          } catch (error2: any) {
            console.error('❌ search also failed:', {
              status: error2?.response?.status,
              statusText: error2?.response?.statusText,
              data: error2?.response?.data,
              message: error2?.message,
            });
          }
        }
        
        if (user && user.fid) {
          const userData = {
            fid: Number(user.fid),
            username: user.username || `user_${user.fid}`,
            pfp_url: user.pfp?.url || user.pfp_url || user.pfp || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.fid}`,
            display_name: user.display_name || user.username || `User ${user.fid}`,
          };
          
          console.log('✅ Returning user data:', userData);
          return res.status(200).json({
            user: userData
          });
        } else {
          console.warn('⚠️ User not found or invalid response:', user);
        }
      } catch (error: any) {
        console.error('❌ Error fetching user by address:', {
          status: error?.response?.status,
          statusText: error?.response?.statusText,
          data: error?.response?.data,
          message: error?.message,
          stack: error?.stack,
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

