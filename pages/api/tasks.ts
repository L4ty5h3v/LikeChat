// API endpoint для получения задач
import type { NextApiRequest, NextApiResponse } from 'next';
import { getLastTenLinks } from '@/lib/db-config';
import type { TaskType } from '@/types';

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
    const validTaskTypes: TaskType[] = ['like', 'recast', 'comment'];
    if (taskType && !validTaskTypes.includes(taskType)) {
      return res.status(400).json({
        error: 'Invalid task type',
        message: `taskType must be one of: ${validTaskTypes.join(', ')}`,
      });
    }

    let links = await getLastTenLinks(taskType);
    
    // Если фильтрация не дала результатов, попробуем получить все ссылки
    if (links.length === 0 && taskType) {
      console.log(`⚠️ API /tasks: No links found for taskType "${taskType}", trying to get all links`);
      links = await getLastTenLinks(undefined);
    }
    
    console.log(`📋 API /tasks: returning ${links.length} links${taskType ? ` (filtered by task: ${taskType})` : ' (all tasks)'}`);
    
    return res.status(200).json({ success: true, links });
  } catch (error: any) {
    console.error('Error in tasks API:', error);
    return res.status(500).json({
      error: 'Failed to get tasks',
      message: error.message,
    });
  }
}

