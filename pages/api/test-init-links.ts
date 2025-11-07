// Тестовый endpoint для проверки инициализации ссылок с логированием
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserByUsername } from '@/lib/neynar';

const initialLinks = [
  'https://farcaster.xyz/gladness/0xaa4214bf',
  'https://farcaster.xyz/svs-smm/0xf17842cb',
  'https://farcaster.xyz/svs-smm/0x4fce02cd',
  'https://farcaster.xyz/svs-smm/0xd976e9a8',
  'https://farcaster.xyz/svs-smm/0x4349a0e0',
  'https://farcaster.xyz/svs-smm/0x3bfa3788',
  'https://farcaster.xyz/svs-smm/0xef39e991',
  'https://farcaster.xyz/svs-smm/0xea43ddbf',
  'https://farcaster.xyz/svs-smm/0x31157f15',
  'https://farcaster.xyz/svs-smm/0xd4a09fb3',
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const results: any[] = [];

  for (let index = 0; index < initialLinks.length; index++) {
    const castUrl = initialLinks[index];
    const urlMatch = castUrl.match(/farcaster\.xyz\/([^\/]+)/);
    const usernameFromUrl = urlMatch ? urlMatch[1] : null;

    const result: any = {
      index: index + 1,
      castUrl,
      usernameFromUrl,
      userData: null,
      error: null,
    };

    if (usernameFromUrl) {
      try {
        console.log(`🔍 [${index + 1}/10] Testing getUserByUsername for: ${usernameFromUrl}`);
        const userData = await getUserByUsername(usernameFromUrl);
        
        result.userData = {
          hasData: !!userData,
          fid: userData?.fid,
          username: userData?.username,
          display_name: userData?.display_name,
          hasPfp: !!(userData?.pfp || userData?.pfp_url || userData?.profile?.pfp),
          pfpUrl: userData?.pfp?.url || userData?.pfp_url || userData?.profile?.pfp?.url,
        };
        
        if (userData && userData.fid) {
          result.success = true;
          console.log(`✅ [${index + 1}/10] Successfully got user data: @${userData.username} (FID: ${userData.fid})`);
        } else {
          result.success = false;
          result.error = 'User data not found or invalid';
          console.warn(`⚠️ [${index + 1}/10] User data not found for: ${usernameFromUrl}`);
        }
      } catch (error: any) {
        result.success = false;
        result.error = {
          message: error?.message,
          status: error?.response?.status,
          statusText: error?.response?.statusText,
          data: error?.response?.data,
        };
        console.error(`❌ [${index + 1}/10] Error getting user data:`, error?.message);
      }
    } else {
      result.success = false;
      result.error = 'No username extracted from URL';
    }

    results.push(result);

    // Задержка между запросами
    if (index < initialLinks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return res.status(200).json({
    success: true,
    total: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results: results,
    summary: {
      withRealData: results.filter(r => r.success && r.userData?.fid > 0).length,
      withFallback: results.filter(r => !r.success || !r.userData?.fid).length,
    },
  });
}

