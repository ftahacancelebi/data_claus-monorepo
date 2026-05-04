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

// Sensor/event base CPM (USD per 1000 events) — used by Phase 1 ingest
// pipeline to compute payout = (cpm/1000) * qualityScore.
export const EVENT_BASE_CPM: Record<string, number> = {
  accelerometer: 0.4,
  gyroscope: 0.4,
  touch: 0.6,
  scroll: 0.5,
  session: 1.5,
  screen_view: 0.3,
};
export const EVENT_DEFAULT_CPM = 0.3;

/**
 * System wallet UUIDs — fixed singletons seeded at boot.
 * Used by ingest payouts (AD_NETWORK), payout treasury, and platform fees.
 */
export const SYSTEM_WALLET_IDS = {
  PLATFORM: '11111111-1111-1111-1111-111111111111',
  AD_NETWORK: '22222222-2222-2222-2222-222222222222',
  PAYOUT_TREASURY: '33333333-3333-3333-3333-333333333333',
} as const;

export const SYSTEM_WALLET_INITIAL_BALANCE = 1_000_000;

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
  DRAFT = 'draft',
  PENDING = 'pending',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum TargetingDeviceType {
  IOS = 'ios',
  ANDROID = 'android',
}

export interface CampaignTargeting {
  appCategories?: string[];
  countries?: string[];
  minQualityScore?: number;
  deviceTypes?: TargetingDeviceType[];
}

export enum TransactionType {
  PAYOUT = 'payout',
  DEPOSIT = 'deposit',
  FEE = 'fee',
  PENDING_RELEASE = 'pending_release',
  AD_REVENUE = 'ad_revenue',
  AD_SPEND = 'ad_spend',
  BUYER_TOPUP = 'buyer_topup',
  WITHDRAWAL = 'withdrawal',
  WITHDRAWAL_REVERSAL = 'withdrawal_reversal',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum PayoutStatus {
  REQUESTED = 'requested',
  APPROVED = 'approved',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  FAILED = 'failed',
}

export enum PayoutMethod {
  BANK_SIMULATION = 'bank_simulation',
  CRYPTO_SIMULATION = 'crypto_simulation',
}
