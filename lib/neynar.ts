// Neynar API для проверки лайков, реккастов и комментариев
import axios from 'axios';
import type { ActivityType, NeynarReaction, NeynarComment } from '@/types';

const NEYNAR_API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY || '';
const NEYNAR_BASE_URL = 'https://api.neynar.com/v2';

const neynarClient = axios.create({
  baseURL: NEYNAR_BASE_URL,
  headers: {
    'api_key': NEYNAR_API_KEY,
    'Content-Type': 'application/json',
  },
});

// Извлечь hash каста из URL
export function extractCastHash(castUrl: string): string | null {
  try {
    // Примеры форматов:
    // https://warpcast.com/username/0x123abc
    // https://warpcast.com/~/conversations/0x123abc
    // https://farcaster.xyz/svs-smm/0x123abc
    const match = castUrl.match(/0x[a-fA-F0-9]+/);
    return match ? match[0] : null;
  } catch (error) {
    console.error('Error extracting cast hash:', error);
    return null;
  }
}

// Получить информацию о касте по хэшу
export async function getCastByHash(castHash: string) {
  if (!NEYNAR_API_KEY) {
    console.warn('⚠️ NEXT_PUBLIC_NEYNAR_API_KEY not configured');
    return null;
  }

  try {
    console.log(`🔍 Fetching cast by hash: ${castHash}`);
    console.log(`🔍 Using Neynar API key: ${NEYNAR_API_KEY ? `${NEYNAR_API_KEY.substring(0, 8)}...` : 'NOT SET'}`);
    
    // Попробуем несколько вариантов endpoint'ов
    let response;
    try {
      // Вариант 1: /farcaster/cast с параметром hash
      response = await neynarClient.get('/farcaster/cast', {
        params: {
          hash: castHash,
        },
      });
      console.log(`✅ Cast data received (method 1):`, response.data);
    } catch (error1: any) {
      console.warn(`⚠️ Method 1 failed:`, error1?.response?.status, error1?.response?.data);
      
      // Вариант 2: /farcaster/cast с параметром identifier
      try {
        response = await neynarClient.get('/farcaster/cast', {
          params: {
            identifier: castHash,
            type: 'hash',
          },
        });
        console.log(`✅ Cast data received (method 2):`, response.data);
      } catch (error2: any) {
        console.warn(`⚠️ Method 2 failed:`, error2?.response?.status, error2?.response?.data);
        throw error2;
      }
    }

    const cast = response.data.result?.cast || response.data.cast || response.data;
    
    if (!cast) {
      console.error('❌ Cast data is null or undefined. Full response:', JSON.stringify(response.data, null, 2));
      return null;
    }

    return cast;
  } catch (error: any) {
    console.error('❌ Error fetching cast:', {
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
      message: error?.message,
      castHash: castHash,
    });
    return null;
  }
}

// Получить данные автора каста по URL
export async function getCastAuthor(castUrl: string) {
  const castHash = extractCastHash(castUrl);
  if (!castHash) {
    console.error('❌ Invalid cast URL - cannot extract hash:', castUrl);
    return null;
  }

  console.log(`🔍 Getting author for cast: ${castUrl} (hash: ${castHash})`);
  const cast = await getCastByHash(castHash);
  
  if (!cast) {
    console.warn(`⚠️ Cast not found for hash: ${castHash}`);
    return null;
  }

  if (!cast.author) {
    console.warn(`⚠️ Cast author not found in response:`, cast);
    return null;
  }

  const authorData = {
    fid: cast.author.fid,
    username: cast.author.username,
    pfp_url: cast.author.pfp?.url || cast.author.pfp_url || cast.author.pfp || `https://api.dicebear.com/7.x/avataaars/svg?seed=${cast.author.fid}`,
    display_name: cast.author.display_name || cast.author.username,
  };

  console.log(`✅ Author data extracted:`, authorData);
  return authorData;
}

// Проверка лайка
export async function checkUserLiked(
  castHash: string,
  userFid: number
): Promise<boolean> {
  if (!NEYNAR_API_KEY) {
    console.warn('⚠️ NEXT_PUBLIC_NEYNAR_API_KEY not configured');
    return false;
  }

  try {
    const response = await neynarClient.get('/farcaster/reactions', {
      params: {
        cast_hash: castHash,
        types: 'likes',
        viewer_fid: userFid,
      },
    });

    const reactions = response.data.reactions || [];
    const found = reactions.some(
      (r: NeynarReaction) => 
        r.reactor_fid === userFid && r.reaction_type === 'like'
    );
    
    console.log(`🔍 Checked like for cast ${castHash}, user ${userFid}: ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
    return found;
  } catch (error: any) {
    console.error('❌ Error checking like:', error?.response?.data || error?.message || error);
    return false;
  }
}

// Проверка реккаста
export async function checkUserRecasted(
  castHash: string,
  userFid: number
): Promise<boolean> {
  if (!NEYNAR_API_KEY) {
    console.warn('⚠️ NEXT_PUBLIC_NEYNAR_API_KEY not configured');
    return false;
  }

  try {
    const response = await neynarClient.get('/farcaster/reactions', {
      params: {
        cast_hash: castHash,
        types: 'recasts',
        viewer_fid: userFid,
      },
    });

    const reactions = response.data.reactions || [];
    const found = reactions.some(
      (r: NeynarReaction) => 
        r.reactor_fid === userFid && r.reaction_type === 'recast'
    );
    
    console.log(`🔍 Checked recast for cast ${castHash}, user ${userFid}: ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
    return found;
  } catch (error: any) {
    console.error('❌ Error checking recast:', error?.response?.data || error?.message || error);
    return false;
  }
}

// Проверка комментария
export async function checkUserCommented(
  castHash: string,
  userFid: number
): Promise<boolean> {
  if (!NEYNAR_API_KEY) {
    console.warn('⚠️ NEXT_PUBLIC_NEYNAR_API_KEY not configured');
    return false;
  }

  try {
    const response = await neynarClient.get('/farcaster/casts', {
      params: {
        parent_hash: castHash,
      },
    });

    const casts = response.data.casts || [];
    const found = casts.some(
      (cast: NeynarComment) => cast.author_fid === userFid
    );
    
    console.log(`🔍 Checked comment for cast ${castHash}, user ${userFid}: ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
    return found;
  } catch (error: any) {
    console.error('❌ Error checking comment:', error?.response?.data || error?.message || error);
    return false;
  }
}

// Универсальная проверка активности
export async function checkUserActivity(
  castUrl: string,
  userFid: number,
  activityType: ActivityType
): Promise<boolean> {
  const castHash = extractCastHash(castUrl);
  if (!castHash) {
    console.error('❌ Invalid cast URL - cannot extract hash:', castUrl);
    return false;
  }

  console.log(`🔍 Checking ${activityType} for cast ${castHash} (${castUrl}), user ${userFid}`);

  switch (activityType) {
    case 'like':
      return await checkUserLiked(castHash, userFid);
    case 'recast':
      return await checkUserRecasted(castHash, userFid);
    case 'comment':
      return await checkUserCommented(castHash, userFid);
    default:
      console.error('❌ Unknown activity type:', activityType);
      return false;
  }
}

// Получить информацию о пользователе по FID
export async function getUserByFid(fid: number) {
  if (!NEYNAR_API_KEY) {
    console.warn('⚠️ NEXT_PUBLIC_NEYNAR_API_KEY not configured');
    return null;
  }

  try {
    const response = await neynarClient.get('/farcaster/user/bulk', {
      params: { fids: fid },
    });
    return response.data.users?.[0] || null;
  } catch (error: any) {
    console.error('❌ Error fetching user:', error?.response?.data || error?.message || error);
    return null;
  }
}
