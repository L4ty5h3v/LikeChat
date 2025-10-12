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
    const match = castUrl.match(/0x[a-fA-F0-9]+/);
    return match ? match[0] : null;
  } catch (error) {
    console.error('Error extracting cast hash:', error);
    return null;
  }
}

// Проверка лайка
export async function checkUserLiked(
  castHash: string,
  userFid: number
): Promise<boolean> {
  try {
    const response = await neynarClient.get('/farcaster/reactions', {
      params: {
        cast_hash: castHash,
        types: 'likes',
        viewer_fid: userFid,
      },
    });

    const reactions = response.data.reactions || [];
    return reactions.some(
      (r: NeynarReaction) => 
        r.reactor_fid === userFid && r.reaction_type === 'like'
    );
  } catch (error) {
    console.error('Error checking like:', error);
    return false;
  }
}

// Проверка реккаста
export async function checkUserRecasted(
  castHash: string,
  userFid: number
): Promise<boolean> {
  try {
    const response = await neynarClient.get('/farcaster/reactions', {
      params: {
        cast_hash: castHash,
        types: 'recasts',
        viewer_fid: userFid,
      },
    });

    const reactions = response.data.reactions || [];
    return reactions.some(
      (r: NeynarReaction) => 
        r.reactor_fid === userFid && r.reaction_type === 'recast'
    );
  } catch (error) {
    console.error('Error checking recast:', error);
    return false;
  }
}

// Проверка комментария
export async function checkUserCommented(
  castHash: string,
  userFid: number
): Promise<boolean> {
  try {
    const response = await neynarClient.get('/farcaster/casts', {
      params: {
        parent_hash: castHash,
      },
    });

    const casts = response.data.casts || [];
    return casts.some(
      (cast: NeynarComment) => cast.author_fid === userFid
    );
  } catch (error) {
    console.error('Error checking comment:', error);
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
    console.error('Invalid cast URL:', castUrl);
    return false;
  }

  switch (activityType) {
    case 'like':
      return await checkUserLiked(castHash, userFid);
    case 'recast':
      return await checkUserRecasted(castHash, userFid);
    case 'comment':
      return await checkUserCommented(castHash, userFid);
    default:
      return false;
  }
}

// Получить информацию о пользователе по FID
export async function getUserByFid(fid: number) {
  try {
    const response = await neynarClient.get('/farcaster/user/bulk', {
      params: { fids: fid },
    });
    return response.data.users[0];
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

