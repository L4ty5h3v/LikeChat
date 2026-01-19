// Типы для LikeChat (Base)

export interface BaseUser {
  fid: number;
  username: string;
  pfp_url: string;
  display_name?: string;
  address?: string;
}

// Base-версия: поддерживаем все типы задач для совместимости с API
export type TaskType = 'like' | 'recast' | 'support';
// ActivityType — алиас для TaskType (для совместимости импорта)
export type ActivityType = TaskType;

export interface LinkSubmission {
  id: string;
  user_fid: number;
  username: string;
  pfp_url: string;
  cast_url: string;
  token_address?: string;
  task_type: TaskType;
  created_at: string;
  completed_by?: number[]; // массив FID пользователей, которые завершили задание
}

export interface UserProgress {
  id: string;
  user_fid: number;
  completed_links: string[]; // ID завершенных ссылок
  token_purchased: boolean;
  token_purchase_tx_hash?: string; // Hash транзакции покупки токена (для dexscreener)
  selected_task?: TaskType;
  current_link_id?: string; // ID опубликованной ссылки
  // Fortune cookie streak data
  current_streak?: number; // Текущий стрик предсказаний
  longest_streak?: number; // Рекордный стрик
  last_fortune_claim_date?: string; // Дата последнего клейма (YYYY-MM-DD)
  total_fortune_claims?: number; // Общее количество клеймов
  created_at: string;
  updated_at: string;
}

export interface TokenPurchaseData {
  txHash: string;
  amount: string;
  timestamp: number;
  user_address: string;
}

