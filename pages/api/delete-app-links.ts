// API endpoint для удаления ссылок на приложения
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllLinks, deleteLink } from '@/lib/db-config';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔍 [DELETE-APP-LINKS] Searching for app links...');
    
    // Получаем все ссылки
    const allLinks = await getAllLinks();
    
    // Находим ссылки на приложения (содержат /miniapps/)
    const appLinks = allLinks.filter(link => {
      if (!link.cast_url) return false;
      try {
        const url = new URL(link.cast_url);
        return url.pathname.includes('/miniapps/');
      } catch {
        return link.cast_url.includes('/miniapps/');
      }
    });
    
    console.log(`📊 [DELETE-APP-LINKS] Found ${appLinks.length} app links to delete:`, 
      appLinks.map(link => ({ id: link.id, url: link.cast_url?.substring(0, 50) + '...' }))
    );
    
    // Удаляем все найденные ссылки на приложения
    const deletedIds: string[] = [];
    const failedIds: string[] = [];
    
    for (const link of appLinks) {
      try {
        const deleted = await deleteLink(link.id);
        if (deleted) {
          deletedIds.push(link.id);
          console.log(`✅ [DELETE-APP-LINKS] Deleted link ${link.id}`);
        } else {
          failedIds.push(link.id);
          console.warn(`⚠️ [DELETE-APP-LINKS] Failed to delete link ${link.id}`);
        }
      } catch (error: any) {
        failedIds.push(link.id);
        console.error(`❌ [DELETE-APP-LINKS] Error deleting link ${link.id}:`, error);
      }
    }
    
    return res.status(200).json({
      success: true,
      totalFound: appLinks.length,
      deleted: deletedIds.length,
      failed: failedIds.length,
      deletedIds,
      failedIds,
      message: `Deleted ${deletedIds.length} app link(s)${failedIds.length > 0 ? `, ${failedIds.length} failed` : ''}`
    });
  } catch (error: any) {
    console.error('❌ [DELETE-APP-LINKS] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete app links',
      message: error.message,
    });
  }
}
