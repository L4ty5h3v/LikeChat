// Скрипт для прямого добавления закрепленной ссылки в Upstash Redis
import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';

// Копия функции baseAppContentUrlFromTokenAddress из lib/base-content.ts
function isHexAddress(value) {
  return !!value && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function base64UrlEncode(bytes) {
  const hasBuffer = typeof globalThis.Buffer !== 'undefined';
  let base64;
  if (hasBuffer) {
    base64 = globalThis.Buffer.from(bytes).toString('base64');
  } else {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    base64 = btoa(bin);
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function baseAppContentUrlFromTokenAddress(tokenAddress) {
  if (!isHexAddress(tokenAddress)) return null;

  const network = 'networks/base-mainnet';
  const addr = tokenAddress.toLowerCase();

  const enc = new TextEncoder();
  const networkBytes = enc.encode(network);
  const addrBytes = enc.encode(addr);

  const payload = new Uint8Array(2 + networkBytes.length + 2 + addrBytes.length);
  let o = 0;
  payload[o++] = 0x0a;
  payload[o++] = networkBytes.length;
  payload.set(networkBytes, o);
  o += networkBytes.length;
  payload[o++] = 0x12;
  payload[o++] = addrBytes.length;
  payload.set(addrBytes, o);

  const inner = new Uint8Array(2 + payload.length);
  inner[0] = 0x0a;
  inner[1] = payload.length;
  inner.set(payload, 2);

  const outer = new Uint8Array(2 + inner.length);
  outer[0] = 0x12;
  outer[1] = inner.length;
  outer.set(inner, 2);

  const id = base64UrlEncode(outer);
  return `https://base.app/content/${id}`;
}

dotenv.config({ path: '.env.local' });

function readEnvTrimmed(key) {
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

function getDbNamespace() {
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

const tokenAddress = '0xbe705864202df9a6c7c57993fde1865ae67825ce';
const position = 5;

async function pinLinkDirect() {
  try {
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

    if (!url || !token) {
      console.error('❌ Upstash Redis credentials not found in environment variables');
      console.error('   Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN');
      process.exit(1);
    }

    const redis = new Redis({
      url,
      token,
    });

    console.log(`📌 Adding pinned link at position ${position}...`);
    console.log(`📍 Token address: ${tokenAddress}`);

    // Получаем все существующие ссылки
    const allLinksRaw = await redis.lrange(KEYS.LINKS, 0, -1);
    const allLinks = allLinksRaw.map((linkStr) => {
      const link = typeof linkStr === 'string' ? JSON.parse(linkStr) : linkStr;
      return { link, str: linkStr };
    });

    // Проверяем, не существует ли уже закрепленная ссылка на этой позиции
    const existingPinned = allLinks.find(
      (item) => item.link.pinned && item.link.pinned_position === position
    );

    if (existingPinned) {
      console.log(`⚠️  Found existing pinned link at position ${position}, removing it...`);
      await redis.lrem(KEYS.LINKS, 1, existingPinned.str);
    }

    // Проверяем, не существует ли уже ссылка с таким token_address
    const existingLink = allLinks.find(
      (item) => item.link.token_address?.toLowerCase() === tokenAddress.toLowerCase()
    );

    if (existingLink) {
      console.log(`⚠️  Found existing link with this token address, updating it...`);
      const updatedLink = {
        ...existingLink.link,
        pinned: true,
        pinned_position: position,
      };
      const index = allLinks.findIndex((item) => item.link.id === existingLink.link.id);
      await redis.lset(KEYS.LINKS, index, JSON.stringify(updatedLink));
      console.log('✅ Link updated and pinned successfully!');
      return;
    }

    // Создаем новую закрепленную ссылку
    const castUrl = baseAppContentUrlFromTokenAddress(tokenAddress) || '';
    const newLink = {
      id: `pinned_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_fid: 0,
      username: 'admin',
      pfp_url: `https://api.dicebear.com/7.x/identicon/svg?seed=${tokenAddress}`,
      cast_url: castUrl,
      token_address: tokenAddress,
      task_type: 'support',
      completed_by: [],
      created_at: new Date().toISOString(),
      pinned: true,
      pinned_position: position,
    };

    // Добавляем ссылку в список
    await redis.lpush(KEYS.LINKS, JSON.stringify(newLink));

    // Пересортируем: закрепленные на своих позициях, остальные по дате
    const allLinksAfterRaw = await redis.lrange(KEYS.LINKS, 0, -1);
    const parsed = allLinksAfterRaw.map((linkStr) => {
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
    for (let i = 0; i < Math.min(5 - pinned.length, regular.length); i++) {
      await redis.rpush(KEYS.LINKS, regular[i].str);
    }

    console.log('✅ Link pinned successfully!');
    console.log('📋 Link details:', {
      id: newLink.id,
      token_address: newLink.token_address,
      pinned: newLink.pinned,
      pinned_position: newLink.pinned_position,
      cast_url: newLink.cast_url,
    });
  } catch (error) {
    console.error('❌ Failed to pin link:', error.message);
    console.error(error);
    process.exit(1);
  }
}

pinLinkDirect();
