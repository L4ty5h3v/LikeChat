// API endpoint для получения топ-20 пользователей по количеству клеймов предсказаний
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllUsersProgress } from '@/lib/db-config';

interface FortuneUser {
  fid: number;
  username?: string;
  current_streak: number;
  longest_streak: number;
  last_fortune_claim_date?: string;
  total_fortune_claims: number;
  claim_count: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const limit = parseInt(req.query.limit as string) || 20;
    
    console.log('🔍 Fetching all users progress...');
    
    // Получаем всех пользователей
    if (!getAllUsersProgress) {
      return res.status(500).json({
        success: false,
        error: 'Upstash Redis not configured',
        message: 'getAllUsersProgress is only available with Upstash Redis',
      });
    }
    
    const allUsers = await getAllUsersProgress();
    
    if (!allUsers || allUsers.length === 0) {
      return res.status(200).json({
        success: true,
        users: [],
        total: 0,
        message: 'No users found'
      });
    }
    
    console.log(`📊 Найдено пользователей: ${allUsers.length}`);
    
    // Парсим данные и собираем информацию о клеймах
    const usersWithClaims: FortuneUser[] = [];
    
    for (const progress of allUsers) {
      // Подсчитываем количество клеймов
      let claimCount = 0;
      
      if (progress.total_fortune_claims !== undefined) {
        claimCount = progress.total_fortune_claims;
      } else if (progress.current_streak !== undefined && progress.current_streak > 0) {
        // Если есть стрик, используем его как минимальную оценку
        claimCount = progress.current_streak;
      } else if (progress.last_fortune_claim_date) {
        // Если есть дата последнего клейма, считаем что был хотя бы 1 клейм
        claimCount = 1;
      }
      
      // Добавляем только пользователей с клеймами
      if (claimCount > 0) {
        usersWithClaims.push({
          fid: progress.user_fid,
          username: (progress as any).username || undefined,
          current_streak: progress.current_streak || 0,
          longest_streak: progress.longest_streak || 0,
          last_fortune_claim_date: progress.last_fortune_claim_date || undefined,
          total_fortune_claims: progress.total_fortune_claims || claimCount,
          claim_count: claimCount,
        });
      }
    }
    
    // Сортируем по количеству клеймов (по убыванию)
    usersWithClaims.sort((a, b) => b.claim_count - a.claim_count);
    
    // Берем топ-N
    const topUsers = usersWithClaims.slice(0, limit);
    
    console.log(`✅ Найдено пользователей с клеймами: ${usersWithClaims.length}`);
    console.log(`🏆 Возвращаю топ-${topUsers.length} пользователей`);
    
    return res.status(200).json({
      success: true,
      users: topUsers,
      total: usersWithClaims.length,
      total_claims: usersWithClaims.reduce((sum, u) => sum + u.claim_count, 0),
    });
  } catch (error: any) {
    console.error('❌ Error fetching top users:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get top fortune users',
      message: error.message,
    });
  }
}

