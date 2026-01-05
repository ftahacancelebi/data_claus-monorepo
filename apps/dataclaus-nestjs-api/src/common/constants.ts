// Revenue sharing constants (matching Go implementation)
export const PLATFORM_FEE_PERCENT = 5;
export const MIN_PAYOUT_THRESHOLD = 0.01;
export const DEFAULT_USER_SHARE_PERCENT = 70;
export const MIN_USER_SHARE_PERCENT = 50;
export const MAX_USER_SHARE_PERCENT = 90;

// Ad eCPM rates (USD per 1000 impressions)
export const ECPM_BANNER = 0.5;
export const ECPM_INTERSTITIAL = 5.0;
export const ECPM_REWARDED = 15.0;

export enum AdType {
  BANNER = 'banner',
  INTERSTITIAL = 'interstitial',
  REWARDED = 'rewarded',
}

export enum WalletType {
  USER = 'user',
  DEVELOPER = 'developer',
  BUYER = 'buyer',
  FAUCET = 'faucet',
  PLATFORM = 'platform',
}

export enum CampaignStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
}

export enum TransactionType {
  PAYOUT = 'payout',
  DEPOSIT = 'deposit',
  FEE = 'fee',
  PENDING_RELEASE = 'pending_release',
  AD_REVENUE = 'ad_revenue',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}
