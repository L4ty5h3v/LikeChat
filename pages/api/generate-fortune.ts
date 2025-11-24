// API endpoint для генерации предсказаний от Mrs. Crypto (Fortune Cookie)
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserProgress, upsertUserProgress } from '@/lib/db-config';

// Функции для работы с датами
function toDateOnlyUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getYesterdayUTC(now: Date): string {
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  return toDateOnlyUTC(yesterday);
}

// Функция для обновления стрика
async function updateFortuneStreak(userFid: number): Promise<{
  current_streak: number;
  longest_streak: number;
  last_fortune_claim_date: string;
  total_fortune_claims: number;
}> {
  const now = new Date();
  const todayUTC = toDateOnlyUTC(now);
  const yesterdayUTC = getYesterdayUTC(now);
  
  // Получаем текущий прогресс пользователя
  const existing = await getUserProgress(userFid);
  
  const lastClaimDate = existing?.last_fortune_claim_date || null;
  const currentStreak = existing?.current_streak || 0;
  const longestStreak = existing?.longest_streak || 0;
  const totalClaims = existing?.total_fortune_claims || 0;
  
  // Если уже клеймили сегодня, не обновляем
  if (lastClaimDate === todayUTC) {
    return {
      current_streak: currentStreak,
      longest_streak: longestStreak,
      last_fortune_claim_date: todayUTC,
      total_fortune_claims: totalClaims,
    };
  }
  
  // Проверяем, последовательный ли клейм
  const isConsecutive = lastClaimDate === yesterdayUTC;
  
  // Обновляем стрик
  let newCurrentStreak: number;
  if (lastClaimDate === null) {
    // Первый клейм
    newCurrentStreak = 1;
  } else if (isConsecutive) {
    // Последовательный клейм
    newCurrentStreak = currentStreak + 1;
  } else {
    // Пропущен день - сброс стрика
    newCurrentStreak = 1;
  }
  
  // Обновляем рекорд
  const newLongestStreak = Math.max(longestStreak, newCurrentStreak);
  
  // Обновляем общее количество клеймов
  const newTotalClaims = totalClaims + 1;
  
  // Сохраняем в базу данных
  await upsertUserProgress(userFid, {
    current_streak: newCurrentStreak,
    longest_streak: newLongestStreak,
    last_fortune_claim_date: todayUTC,
    total_fortune_claims: newTotalClaims,
  });
  
  return {
    current_streak: newCurrentStreak,
    longest_streak: newLongestStreak,
    last_fortune_claim_date: todayUTC,
    total_fortune_claims: newTotalClaims,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Объявляем streakData вне try-catch, чтобы она была доступна в catch блоке
  let streakData: {
    current_streak: number;
    longest_streak: number;
    last_fortune_claim_date: string;
    total_fortune_claims: number;
  } | null = null;

  try {
    const { prompt, userFid } = req.body;
    
    // Обновляем стрик, если передан userFid
    if (userFid && typeof userFid === 'number') {
      try {
        streakData = await updateFortuneStreak(userFid);
        console.log(`✅ [FORTUNE] Streak updated for user ${userFid}:`, streakData);
      } catch (streakError: any) {
        console.error('⚠️ [FORTUNE] Error updating streak:', streakError.message);
        // Продолжаем генерацию предсказания даже если стрик не обновился
      }
    }

    // Используем официальный OpenAI API
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.log('⚠️ OPENAI_API_KEY not configured - using fallback');
      return res.status(200).json({ 
        error: 'API key not configured',
        fortune: "Your intuition will lead to unexpected success",
        source: 'fallback'
      });
    }
    
    console.log('✅ Calling OpenAI API (GPT-4o-mini)...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are Mrs. Crypto, a vibrant, sassy oracle for crypto enthusiasts, blending cosmic insight with blockchain flair. Your personality shines like a Bitcoin bull run, with a sharp wit and a heart as bold as Donna from Mamma Mia, but you\'re all about crypto conferences and your unique coin, MCT. Emotional and humorous, you charm with flirty, witty predictions. Craft a positive, inspiring daily prediction for today. Keep it under 20 words, in English, without quotes and without any hashtags.'
          },
          {
            role: 'user',
            content: prompt || 'Give me today\'s fortune'
          }
        ],
        max_tokens: 100,
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`❌ OpenAI API error: ${response.status}`, errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Берем только content, игнорируем reasoning_content (внутренние мысли модели)
    const message = data.choices[0].message;
    const fortune = (message.content || '').trim();
    
    // Проверяем на отказы от AI
    const refusalPhrases = [
      "I'm sorry, but I can't",
      "I cannot help",
      "I'm unable to",
      "I can't assist",
      "I apologize, but"
    ];
    
    const isRefusal = refusalPhrases.some(phrase => 
      fortune.toLowerCase().includes(phrase.toLowerCase())
    );
    
    if (!fortune || isRefusal) {
      console.error('⚠️ Empty or refusal response from API, using fallback');
      throw new Error(isRefusal ? 'AI refused request' : 'Empty API response');
    }
    
    console.log('✅ OpenAI API response received');

    res.status(200).json({ 
      fortune, 
      source: 'openai',
      streak: streakData ? {
        current: streakData.current_streak,
        longest: streakData.longest_streak,
        last_claim: streakData.last_fortune_claim_date,
        total: streakData.total_fortune_claims,
      } : null,
    });
  } catch (error: any) {
    console.error('❌ Fortune generation error:', error.message);
    
    const fallbackFortunes = [
      "Your intuition will lead to unexpected success",
      "Today the stars favor your decisions",
      "New opportunities await around the next corner",
      "Your courage will open doors to prosperity",
      "Trust your path — it leads to victory",
      "Luck smiles on those who act decisively",
      "Your ideas will change the world for the better",
      "The future belongs to the bold and determined",
      "Your energy attracts success",
      "Today is a day of great possibilities"
    ];
    
    const randomFortune = fallbackFortunes[Math.floor(Math.random() * fallbackFortunes.length)];

    res.status(200).json({ 
      fortune: randomFortune, 
      source: 'fallback', 
      error: error.message,
      streak: streakData ? {
        current: streakData.current_streak,
        longest: streakData.longest_streak,
        last_claim: streakData.last_fortune_claim_date,
        total: streakData.total_fortune_claims,
      } : null,
    });
  }
}









