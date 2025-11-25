// API endpoint для проверки состояния базы данных
import type { NextApiRequest, NextApiResponse } from 'next';
import { getLastTenLinks, getAllLinks, DB_INFO } from '@/lib/db-config';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Получаем все ссылки без фильтрации
    const allLinks = await getAllLinks();
    const lastTenLinks = await getLastTenLinks();
    
    // Группируем по типам задач
    const linksByType = {
      like: allLinks.filter(link => link.task_type === 'like').length,
      recast: allLinks.filter(link => link.task_type === 'recast').length,
      comment: allLinks.filter(link => link.task_type === 'comment').length,
      unknown: allLinks.filter(link => !link.task_type || !['like', 'recast', 'comment'].includes(link.task_type)).length,
    };

    return res.status(200).json({
      success: true,
      dbType: DB_INFO.type,
      persistent: DB_INFO.persistent,
      stats: {
        totalLinks: allLinks.length,
        lastTenLinks: lastTenLinks.length,
        linksByType,
      },
      sampleLinks: lastTenLinks.slice(0, 3).map(link => ({
        id: link.id,
        username: link.username,
        task_type: link.task_type,
        cast_url: link.cast_url.substring(0, 50) + '...',
      })),
    });
  } catch (error: any) {
    console.error('Error checking database:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check database',
      message: error.message,
    });
  }
}

