// Supabase клиент для работы с базой данных
import { createClient } from '@supabase/supabase-js';
import type { LinkSubmission, UserProgress, ActivityType } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Получить последние 10 ссылок (FIFO)
export async function getLastTenLinks(): Promise<LinkSubmission[]> {
  try {
    const { data, error } = await supabase
      .from('link_submissions')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching links:', error);
    return [];
  }
}

// Получить прогресс пользователя
export async function getUserProgress(userFid: number): Promise<UserProgress | null> {
  try {
    const { data, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_fid', userFid)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return data;
  } catch (error) {
    console.error('Error fetching user progress:', error);
    return null;
  }
}

// Создать или обновить прогресс пользователя
export async function upsertUserProgress(progress: Partial<UserProgress>): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_progress')
      .upsert(progress, { onConflict: 'user_fid' });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error upserting user progress:', error);
    return false;
  }
}

// Добавить завершенную ссылку к прогрессу пользователя
export async function markLinkCompleted(userFid: number, linkId: string): Promise<boolean> {
  try {
    const progress = await getUserProgress(userFid);
    
    const completedLinks = progress?.completed_links || [];
    if (!completedLinks.includes(linkId)) {
      completedLinks.push(linkId);
    }

    return await upsertUserProgress({
      user_fid: userFid,
      completed_links: completedLinks,
    });
  } catch (error) {
    console.error('Error marking link completed:', error);
    return false;
  }
}

// Установить флаг покупки токена
export async function markTokenPurchased(userFid: number, txHash: string): Promise<boolean> {
  try {
    return await upsertUserProgress({
      user_fid: userFid,
      token_purchased: true,
    });
  } catch (error) {
    console.error('Error marking token purchased:', error);
    return false;
  }
}

// Установить выбранную активность
export async function setUserActivity(
  userFid: number,
  activityType: ActivityType
): Promise<boolean> {
  try {
    return await upsertUserProgress({
      user_fid: userFid,
      selected_activity: activityType,
    });
  } catch (error) {
    console.error('Error setting user activity:', error);
    return false;
  }
}

// Получить общее количество ссылок в системе
export async function getTotalLinksCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('link_submissions')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error fetching total links count:', error);
    return 0;
  }
}

// Опубликовать новую ссылку
export async function submitLink(
  userFid: number,
  username: string,
  pfpUrl: string,
  castUrl: string,
  activityType: ActivityType
): Promise<LinkSubmission | null> {
  try {
    // Проверка: в системе должно быть минимум 10 ссылок от других пользователей
    const totalLinks = await getTotalLinksCount();
    
    if (totalLinks < 10) {
      throw new Error(`Cannot submit link yet. System needs at least 10 links. Current: ${totalLinks}/10`);
    }

    const { data, error } = await supabase
      .from('link_submissions')
      .insert({
        user_fid: userFid,
        username: username,
        pfp_url: pfpUrl,
        cast_url: castUrl,
        activity_type: activityType,
        completed_by: [],
      })
      .select()
      .single();

    if (error) throw error;

    // Сохранить ID опубликованной ссылки в прогресс пользователя
    await upsertUserProgress({
      user_fid: userFid,
      current_link_id: data.id,
    });

    return data;
  } catch (error) {
    console.error('Error submitting link:', error);
    throw error;
  }
}

// Получить все ссылки для чата
export async function getAllLinks(): Promise<LinkSubmission[]> {
  try {
    const { data, error } = await supabase
      .from('link_submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching all links:', error);
    return [];
  }
}

// Подписка на изменения в ссылках (real-time)
export function subscribeToLinks(callback: (payload: any) => void) {
  return supabase
    .channel('link_submissions_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'link_submissions' },
      callback
    )
    .subscribe();
}

