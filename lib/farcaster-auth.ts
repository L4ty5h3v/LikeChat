// Функции для авторизации через Farcaster
import axios from 'axios';

const NEYNAR_API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY || '';
const NEYNAR_BASE_URL = 'https://api.neynar.com/v2';

// Получить данные пользователя Farcaster по адресу кошелька
export async function getFarcasterUserByAddress(walletAddress: string) {
  if (!NEYNAR_API_KEY) {
    console.warn('⚠️ NEXT_PUBLIC_NEYNAR_API_KEY not configured');
    return null;
  }

  try {
    // Используем Neynar API для поиска пользователя по адресу кошелька
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
      return {
        fid: user.fid,
        username: user.username,
        pfp_url: user.pfp?.url || user.pfp_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.fid}`,
        display_name: user.display_name || user.username,
      };
    }
    return null;
  } catch (error: any) {
    console.error('❌ Error fetching Farcaster user by address:', error?.response?.data || error?.message);
    return null;
  }
}

// Проверить, связан ли адрес кошелька с Farcaster
export async function checkFarcasterConnection(walletAddress: string): Promise<boolean> {
  try {
    const user = await getFarcasterUserByAddress(walletAddress);
    return !!user;
  } catch (error) {
    return false;
  }
}

