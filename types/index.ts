// Типы для приложения ЛайкЧат

export interface FarcasterUser {
  fid: number;
  username: string;
  pfp_url: string;
  display_name?: string;
  address?: string;
}

// Base-версия: основная активность — поддержка поста покупкой post-token.
// (Legacy like/recast оставлены временно, пока переписываем tasks/submit; после будут удалены.)
export type TaskType = 'support' | 'like' | 'recast';
// Обратная совместимость: ActivityType теперь является алиасом для TaskType
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

export interface TaskProgress {
  link_id: string;
  cast_url: string;
  cast_hash: string; // ✅ Hash каста для проверки через Neynar API
  token_address?: string;
  task_type: TaskType;
  user_fid_required: number;
  completed: boolean;
  verified: boolean;
  opened?: boolean; // ✅ Отметка о том, что пользователь открыл пост
  verifying?: boolean; // ✅ Задача проверяется в данный момент
  error?: boolean; // ✅ Ошибка при проверке (cast не найден и т.д.)
  username: string;
  pfp_url: string;
}

export interface TokenPurchaseData {
  txHash: string;
  amount: string;
  timestamp: number;
  user_address: string;
}

// Neynar API типы
export interface NeynarCast {
  hash: string;
  author: {
    fid: number;
    username: string;
    pfp_url: string;
  };
  text: string;
  reactions: {
    likes_count: number;
    recasts_count: number;
  };
}

export interface NeynarReaction {
  reaction_type: 'like' | 'recast';
  cast_hash: string;
  reactor_fid: number;
}

export interface NeynarComment {
  hash: string;
  parent_hash: string;
  author_fid: number;
  text: string;
}

// Диагностика cast для проверки в Neynar Explorer
export interface CastDiagnostics {
  castHash: string;
  isValid: boolean;
  castFound: boolean;
  neynarExplorerUrl: string;
  castData: any | null;
  reactions: {
    likes: any[];
    recasts: any[];
  };
  error?: string;
}

