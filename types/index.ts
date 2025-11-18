// Типы для приложения ЛайкЧат

export interface FarcasterUser {
  fid: number;
  username: string;
  pfp_url: string;
  display_name?: string;
}

export type ActivityType = 'like' | 'recast' | 'comment';

export interface LinkSubmission {
  id: string;
  user_fid: number;
  username: string;
  pfp_url: string;
  cast_url: string;
  activity_type: ActivityType;
  created_at: string;
  completed_by?: number[]; // массив FID пользователей, которые завершили задание
}

export interface UserProgress {
  id: string;
  user_fid: number;
  completed_links: string[]; // ID завершенных ссылок
  token_purchased: boolean;
  token_purchase_tx_hash?: string; // Hash транзакции покупки токена (для dexscreener)
  selected_activity?: ActivityType;
  current_link_id?: string; // ID опубликованной ссылки
  created_at: string;
  updated_at: string;
}

export interface TaskProgress {
  link_id: string;
  cast_url: string;
  cast_hash: string; // ✅ Hash каста для проверки через Neynar API
  activity_type: ActivityType;
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

