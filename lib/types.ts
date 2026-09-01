export type SeriesStatus = 'ongoing' | 'completed';
export type UserRole = 'user' | 'admin';
export type TransactionType = 'purchase' | 'spend' | 'refund' | 'reward';
export type TransactionStatus = 'pending' | 'completed' | 'failed';
export type SubscriptionPlan = 'monthly' | 'yearly';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';

export interface Category {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  sort_order: number;
  created_at: string;
}

export interface Series {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  banner_image_url: string | null;
  category_id: string | null;
  rating: number;
  total_episodes: number;
  status: SeriesStatus;
  is_featured: boolean;
  is_free: boolean;
  sort_order: number;
  view_count: number;
  created_at: string;
}

export interface Episode {
  id: string;
  series_id: string;
  episode_number: number;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_path: string | null;
  duration: number;
  is_free: boolean;
  coin_price: number;
  view_count: number;
  created_at: string;
}

export interface Profile {
  id: string;
  name: string;
  avatar_url: string | null;
  coins: number;
  role: UserRole;
  created_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  series_id: string;
  created_at: string;
}

export interface WatchHistoryItem {
  id: string;
  user_id: string;
  series_id: string;
  episode_id: string;
  position: number;
  duration: number;
  watched_at: string;
}

export interface UnlockedEpisode {
  id: string;
  user_id: string;
  episode_id: string;
  unlocked_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  coins: number;
  status: TransactionStatus;
  description: string | null;
  reference_id: string | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  start_date: string;
  expiry_date: string;
  reference_id: string | null;
  created_at: string;
}

export interface SeriesWithCategory extends Series {
  categories?: Category | null;
}

export interface ContinueWatchingItem {
  series_id: string;
  episode_id: string;
  position: number;
  duration: number;
  watched_at: string;
  series_title: string;
  series_cover: string | null;
  episode_number: number;
  episode_title: string;
}
