// API endpoint для добавления ссылок определенного типа (без удаления существующих)
import type { NextApiRequest, NextApiResponse } from 'next';
import { addLinksForTaskType } from '@/lib/db-config';
import type { TaskType } from '@/types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Проверяем секретный ключ для безопасности (опционально)
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

  try {
    const { taskType } = req.body;
    
    if (!taskType) {
      return res.status(400).json({
        error: 'Missing taskType',
        message: 'taskType is required. Must be "support".'
      });
    }

    // Валидация taskType
    const validTaskTypes: TaskType[] = ['support'];
    if (!validTaskTypes.includes(taskType)) {
      return res.status(400).json({
        error: 'Invalid task type',
        message: `taskType must be one of: ${validTaskTypes.join(', ')}`,
      });
    }

    if (!addLinksForTaskType) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'addLinksForTaskType is only available with Upstash Redis. Please configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.'
      });
    }

    const result = await addLinksForTaskType(taskType);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: `Successfully added ${result.count} links for task type "${taskType}"`,
        count: result.count,
        taskType: taskType
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error || 'Failed to add links',
        taskType: taskType
      });
    }
  } catch (error: any) {
    console.error('Error in add-links API:', error);
    return res.status(500).json({
      error: 'Failed to add links',
      message: error.message,
    });
  }
}

