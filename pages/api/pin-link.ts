// API endpoint для добавления закрепленной ссылки на определенную позицию
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllLinks } from '@/lib/db-config';
import { baseAppContentUrlFromTokenAddress, isHexAddress } from '@/lib/base-content';
import { Redis } from '@upstash/redis';
import type { LinkSubmission } from '@/types';
import { TASKS_LIMIT } from '@/lib/app-config';

function readEnvTrimmed(key: string): string | undefined {
  const v = process.env[key];
  if (!v) return undefined;
  let t = v.trim();
  if (
    (t.startsWith('"') && t.endsWith('"') && t.length >= 2) ||
    (t.startsWith("'") && t.endsWith("'") && t.length >= 2)
  ) {
    t = t.slice(1, -1).trim();
  }
  return t ? t : undefined;
}

function getDbNamespace(): string {
  const explicit = readEnvTrimmed('LIKECHAT_DB_NAMESPACE');
  if (explicit) return explicit.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  const pid = readEnvTrimmed('VERCEL_PROJECT_ID');
  if (pid) return pid.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  const slug = readEnvTrimmed('VERCEL_GIT_REPO_SLUG');
  if (slug) return slug.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return 'default';
}

const KEY_PREFIX = `likechat:${getDbNamespace()}`;
const KEYS = {
  LINKS: `${KEY_PREFIX}:links`,
};

let redis: Redis | null = null;

if (typeof window === 'undefined') {
  const url =
    readEnvTrimmed('UPSTASH_REDIS_REST_URL') ||
    readEnvTrimmed('KV_REST_API_URL') ||
    readEnvTrimmed('STORAGE_REST_API_URL');
  const token =
    readEnvTrimmed('UPSTASH_REDIS_REST_TOKEN') ||
    readEnvTrimmed('KV_REST_API_TOKEN') ||
    readEnvTrimmed('KV_REST_API_READ_ONLY_TOKEN') ||
    readEnvTrimmed('STORAGE_REST_API_TOKEN') ||
    readEnvTrimmed('STORAGE_REST_API_READ_ONLY_TOKEN');

  if (url && token) {
    redis = new Redis({
      url,
      token,
    });
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Проверяем секретный ключ для безопасности
  const secretKey = req.body.secretKey || req.query.secretKey;
  const requiredSecretKey = process.env.INIT_LINKS_SECRET_KEY;
  
  if (requiredSecretKey && requiredSecretKey.trim() !== '') {
    if (!secretKey || secretKey !== requiredSecretKey) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Secret key is missing or invalid. Set INIT_LINKS_SECRET_KEY on Vercel or provide the correct key.'
      });
    }
  }

  if (!redis) {
    return res.status(503).json({
      error: 'Service unavailable',
      message: 'Upstash Redis not configured'
    });
  }

  try {
    const { tokenAddress, position, username, pfpUrl } = req.body;
    
    if (!tokenAddress) {
      return res.status(400).json({
        error: 'Missing tokenAddress',
        message: 'tokenAddress is required (0x... address)'
      });
    }

    if (!isHexAddress(tokenAddress)) {
      return res.status(400).json({
        error: 'Invalid tokenAddress',
        message: 'tokenAddress must be a valid hex address (0x...)'
      });
    }

    const pinPosition = position ? parseInt(position, 10) : 5;
    if (isNaN(pinPosition) || pinPosition < 1 || pinPosition > TASKS_LIMIT) {
      return res.status(400).json({
        error: 'Invalid position',
        message: `position must be between 1 and ${TASKS_LIMIT}`
      });
    }

    // Проверяем, не существует ли уже закрепленная ссылка на этой позиции
    const allLinks = await getAllLinks();
    const existingPinned = allLinks.find(
      (link) => link.pinned && link.pinned_position === pinPosition
    );

    if (existingPinned) {
      // Удаляем старую закрепленную ссылку с этой позиции
      const allLinksRaw = await redis.lrange(KEYS.LINKS, 0, -1);
      for (let i = 0; i < allLinksRaw.length; i++) {
        const linkStr = allLinksRaw[i];
        const link = typeof linkStr === 'string' ? JSON.parse(linkStr) : linkStr;
        if (link.id === existingPinned.id) {
          await redis.lrem(KEYS.LINKS, 1, linkStr);
          break;
        }
      }
    }

    // Проверяем, не существует ли уже ссылка с таким token_address
    const existingLink = allLinks.find(
      (link) => link.token_address?.toLowerCase() === tokenAddress.toLowerCase()
    );

    if (existingLink) {
      // Обновляем существующую ссылку, делая её закрепленной
      const allLinksRaw = await redis.lrange(KEYS.LINKS, 0, -1);
      let updatedLink: LinkSubmission | null = null;
      
      // Обновляем ссылку
      for (let i = 0; i < allLinksRaw.length; i++) {
        const linkStr = allLinksRaw[i];
        const link = typeof linkStr === 'string' ? JSON.parse(linkStr) : linkStr;
        if (link.id === existingLink.id) {
          updatedLink = {
            ...link,
            pinned: true,
            pinned_position: pinPosition,
          };
          await redis.lset(KEYS.LINKS, i, JSON.stringify(updatedLink));
          break;
        }
      }
      
      if (!updatedLink) {
        return res.status(500).json({
          error: 'Failed to update link',
          message: 'Link found but could not be updated',
        });
      }
      
      // Пересортируем список: закрепленные на своих позициях, остальные по дате
      const allLinksAfterRaw = await redis.lrange(KEYS.LINKS, 0, -1);
      const parsed = allLinksAfterRaw.map((linkStr: any) => {
        const link = typeof linkStr === 'string' ? JSON.parse(linkStr) : linkStr;
        return { link, str: linkStr };
      });

      const pinned = parsed.filter((p) => p.link.pinned);
      const regular = parsed.filter((p) => !p.link.pinned).sort((a, b) => {
        const dateA = new Date(a.link.created_at).getTime();
        const dateB = new Date(b.link.created_at).getTime();
        return dateB - dateA;
      });

      // Очищаем список и добавляем закрепленные + ограниченное количество обычных
      await redis.del(KEYS.LINKS);
      for (const p of pinned) {
        await redis.rpush(KEYS.LINKS, p.str);
      }
      for (let i = 0; i < Math.min(TASKS_LIMIT - pinned.length, regular.length); i++) {
        await redis.rpush(KEYS.LINKS, regular[i].str);
      }
      
      return res.status(200).json({
        success: true,
        message: `Link pinned to position ${pinPosition}`,
        link: updatedLink,
      });
    }

    // Создаем новую закрепленную ссылку
    const castUrl = baseAppContentUrlFromTokenAddress(tokenAddress) || '';
    const newLink: LinkSubmission = {
      id: `pinned_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_fid: 0,
      username: username || 'admin',
      pfp_url: pfpUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${tokenAddress}`,
      cast_url: castUrl,
      token_address: tokenAddress,
      task_type: 'support',
      completed_by: [],
      created_at: new Date().toISOString(),
      pinned: true,
      pinned_position: pinPosition,
    };

    // Добавляем ссылку в список
    await redis.lpush(KEYS.LINKS, JSON.stringify(newLink));

    // Keep queue bounded: always keep only TASKS_LIMIT newest links (но закрепленные не удаляются)
    // Для этого нужно пересчитать, сколько обычных ссылок можно оставить
    const allLinksAfter = await getAllLinks();
    const pinnedCount = allLinksAfter.filter((l) => l.pinned).length;
    const maxRegular = TASKS_LIMIT - pinnedCount;
    
    // Получаем все ссылки и сортируем: сначала закрепленные, потом обычные по дате
    const allLinksRaw = await redis.lrange(KEYS.LINKS, 0, -1);
    const parsed = allLinksRaw.map((linkStr: any) => {
      const link = typeof linkStr === 'string' ? JSON.parse(linkStr) : linkStr;
      return {
        link,
        str: linkStr,
      };
    });

    const pinned = parsed.filter((p) => p.link.pinned);
    const regular = parsed.filter((p) => !p.link.pinned).sort((a, b) => {
      const dateA = new Date(a.link.created_at).getTime();
      const dateB = new Date(b.link.created_at).getTime();
      return dateB - dateA;
    });

    // Очищаем список и добавляем закрепленные + ограниченное количество обычных
    await redis.del(KEYS.LINKS);
    for (const p of pinned) {
      await redis.rpush(KEYS.LINKS, p.str);
    }
    for (let i = 0; i < Math.min(maxRegular, regular.length); i++) {
      await redis.rpush(KEYS.LINKS, regular[i].str);
    }

    return res.status(200).json({
      success: true,
      message: `Link pinned to position ${pinPosition}`,
      link: newLink,
    });
  } catch (error: any) {
    console.error('Error pinning link:', error);
    return res.status(500).json({
      error: 'Failed to pin link',
      message: error.message,
    });
  }
}
