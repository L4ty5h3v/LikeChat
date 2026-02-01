// API endpoint для получения задач
import type { NextApiRequest, NextApiResponse } from 'next';
import { getLastTenLinks } from '@/lib/db-config';
import type { TaskType } from '@/types';
import { TASKS_LIMIT } from '@/lib/app-config';

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
    
    // Валидация taskType - для Farcaster поддерживаем 'like', 'recast', 'comment', 'support'
    const validTaskTypes: TaskType[] = ['like', 'recast', 'comment', 'support'];
    if (taskType && !validTaskTypes.includes(taskType)) {
      return res.status(400).json({
        error: 'Invalid task type',
        message: `taskType must be one of: ${validTaskTypes.join(', ')}`,
      });
    }

    // ⚠️ ВАЖНО: Строгая фильтрация - возвращаем только ссылки нужного типа (может быть пустой массив)
    const allLinksFromDb = await getLastTenLinks(taskType);
    const links = allLinksFromDb.slice(0, TASKS_LIMIT);
    
    // Подробное логирование для диагностики
    console.log('='.repeat(80));
    console.log(`📋 [API /tasks] Request details:`);
    console.log(`   - taskType: ${taskType || 'undefined (all tasks)'}`);
    console.log(`   - TASKS_LIMIT: ${TASKS_LIMIT}`);
    console.log(`   - Links from DB: ${allLinksFromDb.length}`);
    console.log(`   - Links after slice(0, ${TASKS_LIMIT}): ${links.length}`);
    console.log(`   - Expected: ${TASKS_LIMIT}, Actual: ${links.length}, Difference: ${TASKS_LIMIT - links.length}`);
    
    if (links.length > 0) {
      console.log(`   - Link details:`);
      links.forEach((link, idx) => {
        console.log(`     [${idx + 1}] ID: ${link.id}, Type: ${link.task_type}, Username: ${link.username}, Pinned: ${link.pinned || false}`);
      });
    } else {
      console.log(`   ⚠️  WARNING: No links returned!`);
    }
    
    if (links.length < TASKS_LIMIT) {
      console.log(`   ⚠️  WARNING: Only ${links.length} links returned, expected ${TASKS_LIMIT}`);
    }
    console.log('='.repeat(80));
    
    return res.status(200).json({ success: true, links });
  } catch (error: any) {
    console.error('Error in tasks API:', error);
    return res.status(500).json({
      error: 'Failed to get tasks',
      message: error.message,
    });
  }
}

