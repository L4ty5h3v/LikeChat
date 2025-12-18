// API endpoint для получения задач
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllLinks } from '@/lib/db-config';
import type { TaskType } from '@/types';
import { TASKS_LIMIT } from '@/lib/app-config';
import { isTokenTradableCached } from '@/lib/tradable';
import { parseUnits } from 'viem';
import { BUY_AMOUNT_USDC_DECIMAL } from '@/lib/app-config';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Отключаем кеширование для получения актуальных данных
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    // Получаем taskType из query параметров
    const taskType = req.query.taskType as TaskType | undefined;
    
    // Валидация taskType
    const validTaskTypes: TaskType[] = ['support'];
    if (taskType && !validTaskTypes.includes(taskType)) {
      return res.status(400).json({
        error: 'Invalid task type',
        message: `taskType must be one of: ${validTaskTypes.join(', ')}`,
      });
    }

    // Загружаем все ссылки и сортируем (новые первыми), чтобы после фильтрации по ликвидности
    // всё равно можно было набрать TASKS_LIMIT.
    const all = await getAllLinks();
    const sorted = [...all].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const usdcAmountIn = parseUnits(BUY_AMOUNT_USDC_DECIMAL, 6);
    const result: typeof sorted = [];

    for (const link of sorted) {
      if (result.length >= TASKS_LIMIT) break;
      if (taskType && link.task_type !== taskType) continue; // strict filtering
      if (!link.token_address) continue;

      const tradable = await isTokenTradableCached(link.token_address, usdcAmountIn);
      if (!tradable) continue;

      result.push(link);
    }
    
    console.log(
      `📋 API /tasks: returning ${result.length} links${taskType ? ` (strictly filtered by task: ${taskType})` : ' (all tasks)'} (tradable-only)`
    );
    
    return res.status(200).json({ success: true, links: result });
  } catch (error: any) {
    console.error('Error in tasks API:', error);
    return res.status(500).json({
      error: 'Failed to get tasks',
      message: error.message,
    });
  }
}

