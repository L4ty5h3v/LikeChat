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
  selected_activity?: ActivityType;
  current_link_id?: string; // ID опубликованной ссылки
  created_at: string;
  updated_at: string;
}

export interface TaskProgress {
  link_id: string;
  cast_url: string;
  completed: boolean;
  verified: boolean;
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

