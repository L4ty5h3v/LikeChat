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
    
    // Валидация taskType
    const validTaskTypes: TaskType[] = ['support'];
    if (taskType && !validTaskTypes.includes(taskType)) {
      return res.status(400).json({
        error: 'Invalid task type',
        message: `taskType must be one of: ${validTaskTypes.join(', ')}`,
      });
    }

    // ⚠️ ВАЖНО: Строгая фильтрация - возвращаем только ссылки нужного типа (может быть пустой массив)
    const links = (await getLastTenLinks(taskType)).slice(0, TASKS_LIMIT);
    
    console.log(
      `📋 API /tasks: returning ${links.length} links${taskType ? ` (strictly filtered by task: ${taskType})` : ' (all tasks)'}`
    );
    
    return res.status(200).json({ success: true, links });
  } catch (error: any) {
    console.error('Error in tasks API:', error);
    return res.status(500).json({
      error: 'Failed to get tasks',
      message: error.message,
    });
  }
}

