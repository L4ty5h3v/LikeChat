// Тестовый endpoint для проверки получения данных пользователя по username
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserByUsername } from '@/lib/neynar';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const username = (req.query.username as string) || 'svs-smm';

  try {
    console.log(`🔍 Testing getUserByUsername for: ${username}`);
    const userData = await getUserByUsername(username);

    if (userData && userData.fid) {
      return res.status(200).json({
        success: true,
        username: username,
        userData: {
          fid: userData.fid,
          username: userData.username,
          display_name: userData.display_name || userData.username,
          pfp_url: userData.pfp?.url || userData.pfp_url || userData.pfp,
          bio: userData.bio,
        },
        rawData: userData,
      });
    } else {
      return res.status(200).json({
        success: false,
        username: username,
        error: 'User not found or invalid data',
        userData: userData,
      });
    }
  } catch (error: any) {
    console.error('Error in test-user:', error);
    return res.status(500).json({
      success: false,
      username: username,
      error: error?.message || 'Unknown error',
      details: error?.response?.data || error,
    });
  }
}

