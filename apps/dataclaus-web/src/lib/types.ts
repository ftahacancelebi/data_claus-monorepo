export type UserRole = 'user' | 'developer' | 'buyer' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface Wallet {
  id: string;
  owner_id: string;
  type: string;
  balance: number;
  pending_balance: number; // For amounts < $0.01
  currency: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  source_wallet_id: string;
  dest_wallet_id: string;
  amount: number;
  currency: string;
  reference_id: string;
  type: string;
  status: string;
  created_at: string;
}

export interface Campaign {
  id: string;
  buyer_id: string;
  name: string;
  total_budget: number;
  remaining: number;
  status: string;
  created_at: string;
}

export interface ScoredEvent {
  id: string;
  event_id: string;
  developer_id: string;
  user_id: string;
  quality_score: number;
  is_human: boolean;
  jitter: number;
  time_variance: number;
  campaign_id?: string;
  payout: number;
  processed_at: string;
}

export interface ApiKey {
  id: string;
  developer_id?: string;
  key_prefix: string;
  name: string;
  is_active: boolean;
  last_used_at?: string;
  created_at: string;
  raw_key?: string; // Only returned on creation
}

export interface AppLink {
  id: string;
  developer_id: string;
  name: string;
  description: string;
  url: string;
  category: string;
  revenue_share_percent: number; // Developer's share percentage (e.g., 70 = 70%)
  is_active: boolean;
  created_at: string;
}

export interface DataProduct {
  id: string;
  developer_id: string;
  name: string;
  description: string;
  price: number;
  data_type: string;
  revenue_share_percent: number;
  is_active: boolean;
  created_at: string;
}

export interface UserEarnings {
  user_id: string;
  total_earned: number;
  pending_balance: number; // Accumulated but not yet released (< $0.01)
  available_balance: number;
  quality_score: number;
  total_active_time_seconds: number;
}

// Revenue sharing configuration
// Platform fee is fixed at 5%, user share is developer-configurable (50-90%)
export const REVENUE_SHARES = {
  PLATFORM_FEE_PERCENT: 5, // Platform takes fixed 5%
  DEFAULT_USER_SHARE_PERCENT: 70, // Default user share
  MIN_USER_SHARE_PERCENT: 50, // Minimum user share allowed
  MAX_USER_SHARE_PERCENT: 90, // Maximum user share allowed
  MIN_PAYOUT_THRESHOLD: 0.01, // Minimum $0.01 to release to wallet
};

// Calculate developer share based on user share
export function calculateDeveloperShare(userSharePercent: number): number {
  return 100 - REVENUE_SHARES.PLATFORM_FEE_PERCENT - userSharePercent;
}

export interface Developer {
  id: string;
  name: string;
  email: string;
  user_share_percent: number; // Configurable 50-90%
  dev_share_percent: number; // Calculated: 100 - 5 - user_share
}

// Format money with high precision for display
export function formatMoney(amount: number, precision = 8): string {
  if (amount === 0) return '$0.00';
  if (Math.abs(amount) < 0.01) {
    // Show high precision for micro amounts
    return `$${amount.toFixed(precision)}`;
  }
  return `$${amount.toFixed(2)}`;
}

// Format money for display, showing pending if below threshold
export function formatBalance(available: number, pending: number): string {
  const availableStr = formatMoney(available, 2);
  if (pending > 0) {
    return `${availableStr} (+${formatMoney(pending, 6)} pending)`;
  }
  return availableStr;
}
