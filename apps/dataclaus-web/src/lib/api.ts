import type {
  Wallet,
  Transaction,
  Campaign,
  ScoredEvent,
  ApiKey,
} from './types';

const API_BASE = '/api';

// NestJS response wrapper interface
interface NestJSResponse<T> {
  data: T;
  statusCode: number;
  message: string;
  timestamp: string;
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  // Get the auth token from localStorage (support both developer and user contexts)
  const token = typeof window !== 'undefined' 
    ? (localStorage.getItem('dataclaus_token') || localStorage.getItem('dataclaus_user_access_token'))
    : null;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };
  
  // Add Authorization header if token exists
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || 'Request failed');
  }
  const json = await res.json();
  // Handle NestJS wrapped response format
  if (json && typeof json === 'object' && 'data' in json && 'statusCode' in json) {
    return json.data as T;
  }
  return json;
}

// Users
export const createUser = (data: {
  email: string;
  name: string;
  password: string;
}) =>
  request<{ id: string; email: string; name: string }>('/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getUser = (id: string) =>
  request<{ id: string; email: string; name: string }>(`/users/${id}`);

// Login returns NestJS format with accessToken and user object
export const loginUser = async (email: string, password: string): Promise<{
  id: string;
  email: string;
  name: string;
  role: string;
  token: string;
}> => {
  const response = await request<{
    accessToken: string;
    user: { id: string; email: string; name: string; role: string };
  }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  
  return {
    id: response.user.id,
    email: response.user.email,
    name: response.user.name,
    role: response.user.role,
    token: response.accessToken,
  };
};

// Developers
export const registerDeveloper = (data: {
  name: string;
  email: string;
  password: string;
}) =>
  request<{ id: string; name: string; email: string }>('/developers', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export interface DeveloperResponse {
  id: string;
  name: string;
  email: string;
  user_share_percent: number;
  dev_share_percent: number;
}

export const getDeveloper = (id: string) =>
  request<DeveloperResponse>(`/developers/${id}`);

export const updateDeveloperUserShare = (
  id: string,
  userSharePercent: number
) =>
  request<DeveloperResponse>(`/developers/${id}/user-share`, {
    method: 'PUT',
    body: JSON.stringify({ user_share_percent: userSharePercent }),
  });

export const generateApiKey = (developerId: string, name: string) =>
  request<ApiKey & { raw_key: string }>(`/developers/${developerId}/api-keys`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });

export const listApiKeys = (developerId: string) =>
  request<ApiKey[]>(`/developers/${developerId}/api-keys`);

export const revokeApiKey = (developerId: string, keyId: string) =>
  request<{ status: string }>(`/developers/${developerId}/api-keys/${keyId}`, {
    method: 'DELETE',
  });

// Wallets
export const createWallet = (data: {
  owner_id: string;
  type: string;
  currency: string;
}) =>
  request<Wallet>('/wallets', { method: 'POST', body: JSON.stringify(data) });

export const getWallet = (id: string) => request<Wallet>(`/wallets/${id}`);

export const getWalletsByOwner = (ownerId: string) =>
  request<Wallet[]>(`/wallets/owner/${ownerId}`);

export const creditWallet = (id: string, amount: number) =>
  request<{ status: string }>(`/wallets/${id}/credit`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });

export const debitWallet = (id: string, amount: number) =>
  request<{ status: string }>(`/wallets/${id}/debit`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });

// Campaigns
export const createCampaign = (data: {
  buyer_id: string;
  name: string;
  budget: number;
}) =>
  request<Campaign>('/campaigns', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getCampaigns = () => request<Campaign[]>('/campaigns');

export const getCampaign = (id: string) =>
  request<Campaign>(`/campaigns/${id}`);

export const getCampaignsByBuyer = (buyerId: string) =>
  request<Campaign[]>(`/campaigns/buyer/${buyerId}`);

export const updateCampaignStatus = (id: string, status: string) =>
  request<{ status: string }>(`/campaigns/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

// Transactions
export const getTransactions = (limit = 20, offset = 0) =>
  request<Transaction[]>(`/transactions?limit=${limit}&offset=${offset}`);

export const getTransaction = (id: string) =>
  request<Transaction>(`/transactions/${id}`);

export const getWalletTransactions = (
  walletId: string,
  limit = 20,
  offset = 0
) =>
  request<Transaction[]>(
    `/wallets/${walletId}/transactions?limit=${limit}&offset=${offset}`
  );

// Analytics
export const getAnalyticsEvents = (limit = 20, offset = 0) =>
  request<ScoredEvent[]>(`/analytics/events?limit=${limit}&offset=${offset}`);

export const getUserQualityScore = (userId: string) =>
  request<{ user_id: string; quality_score: number }>(
    `/analytics/quality-score/${userId}`
  );

export interface DashboardStats {
  total_events: number;
  total_users: number;
  total_developers: number;
  average_quality: number;
  total_payouts: number;
  active_campaigns: number;
}

export const getDashboard = (): Promise<DashboardStats> =>
  request('/analytics/dashboard');

// Health
export const getHealth = () =>
  request<{ status: string; version: string }>('/health');

// Configuration
export interface RevenueShareConfig {
  user_share_percent: number;
  developer_share_percent: number;
  platform_fee_percent: number;
  min_payout_threshold: number;
}

export const getRevenueShares = () =>
  request<RevenueShareConfig>('/config/revenue-shares');

// Release pending balance
export const releasePendingBalance = (walletId: string) =>
  request<{ status: string; released: number }>(
    `/wallets/${walletId}/release-pending`,
    {
      method: 'POST',
    }
  );

// Applications
export interface Application {
  id: string;
  developer_id: string;
  name: string;
  description: string;
  category: string;
  website_url: string;
  is_active: boolean;
  total_events: number;
  total_users: number;
  total_revenue: number;
  quality_score: number;
  user_share_percent: number; // Revenue share for users (50-90%)
  api_key_prefix?: string;
  api_key?: string; // Only returned on create
  created_at: string;
  updated_at: string;
}

export interface ApplicationStats {
  application_id: string;
  total_events: number;
  total_users: number;
  total_revenue: number;
  avg_quality: number;
  events_today: number;
  events_week: number;
  events_month: number;
}

export const createApplication = (
  developerId: string,
  data: {
    name: string;
    description?: string;
    category?: string;
    website_url?: string;
    user_share_percent?: number;
  }
) =>
  request<Application>(`/developers/${developerId}/applications`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getApplications = (developerId: string) =>
  request<Application[]>(`/developers/${developerId}/applications`);

export const getApplication = (id: string) =>
  request<Application>(`/applications/${id}`);

export const getApplicationStats = (id: string) =>
  request<ApplicationStats>(`/applications/${id}/stats`);

export const updateApplication = (
  id: string,
  data: {
    name?: string;
    description?: string;
    category?: string;
    website_url?: string;
    user_share_percent?: number;
  }
) =>
  request<Application>(`/applications/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const toggleApplicationStatus = (id: string, isActive: boolean) =>
  request<{ status: string; is_active: boolean }>(`/applications/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: isActive }),
  });

export const deleteApplication = (id: string) =>
  request<{ status: string }>(`/applications/${id}`, {
    method: 'DELETE',
  });

// ============================================================
// USER IDENTITY LINKING
// Links external user IDs from developer apps to DataClaus users
// ============================================================

export interface DataClausUser {
  id: string;
  email?: string;
  phone?: string;
  wallet_id: string;
  quality_score: number;
  total_earned: number;
  created_at: string;
}

export interface UserLink {
  id: string;
  dataclaus_user_id: string;
  developer_id: string;
  application_id: string;
  external_user_id: string;
  device_fingerprint?: string;
  created_at: string;
}

export interface LinkUserRequest {
  external_user_id: string;
  email?: string;
  phone?: string;
  device_fingerprint?: string;
}

export interface LinkUserResponse {
  dataclaus_user_id: string;
  user_token: string; // Short-lived token for subsequent API calls
  is_new_user: boolean;
  wallet_id: string;
}

export const linkUser = (applicationId: string, data: LinkUserRequest) =>
  request<LinkUserResponse>(`/applications/${applicationId}/users/link`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getUserByExternalId = (applicationId: string, externalUserId: string) =>
  request<DataClausUser>(`/applications/${applicationId}/users/external/${externalUserId}`);

export const getUserEarnings = (userId: string) =>
  request<{
    total_earned: number;
    pending_balance: number;
    available_balance: number;
    quality_score: number;
  }>(`/users/${userId}/earnings`);

// ============================================================
// AD REVENUE TRACKING
// Track ad impressions and revenue through DataClaus-managed ads
// ============================================================

export type AdType = 'banner' | 'interstitial' | 'rewarded' | 'native';

export interface AdImpression {
  id: string;
  application_id: string;
  user_id: string;
  ad_type: AdType;
  ad_unit_id: string;
  revenue: number;
  currency: string;
  created_at: string;
}

export interface AdConfig {
  ad_unit_ids: {
    banner?: string;
    interstitial?: string;
    rewarded?: string;
    native?: string;
  };
  enabled: boolean;
  test_mode: boolean;
}

export const getAdConfig = (applicationId: string) =>
  request<AdConfig>(`/applications/${applicationId}/ads/config`);

export const recordAdImpression = (
  applicationId: string,
  data: {
    user_token: string;
    ad_type: AdType;
    ad_unit_id: string;
    revenue: number;
    currency?: string;
  }
) =>
  request<{ status: string; impression_id: string }>(
    `/applications/${applicationId}/ads/impression`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );

export const getAdRevenueSummary = (applicationId: string) =>
  request<{
    total_impressions: number;
    total_revenue: number;
    revenue_by_type: Record<AdType, number>;
    today_revenue: number;
  }>(`/applications/${applicationId}/ads/summary`);

// ============================================================
// WEBHOOK SECRETS
// For secure server-to-server communication
// ============================================================

export interface WebhookSecret {
  id: string;
  developer_id: string;
  secret_prefix: string; // First 8 chars for identification
  created_at: string;
  last_used_at?: string;
}

export const generateWebhookSecret = (developerId: string) =>
  request<{ secret: string; id: string }>(`/developers/${developerId}/webhook-secret`, {
    method: 'POST',
  });

export const getWebhookSecrets = (developerId: string) =>
  request<WebhookSecret[]>(`/developers/${developerId}/webhook-secrets`);

export const revokeWebhookSecret = (developerId: string, secretId: string) =>
  request<{ status: string }>(`/developers/${developerId}/webhook-secrets/${secretId}`, {
    method: 'DELETE',
  });

// Webhook event types that DataClaus sends to developer backends
export type WebhookEventType =
  | 'user.earnings.updated'
  | 'user.quality.changed'
  | 'payout.completed'
  | 'ad.revenue.recorded'
  | 'campaign.matched';

export interface WebhookPayload {
  event_type: WebhookEventType;
  timestamp: string;
  data: Record<string, unknown>;
  signature: string; // HMAC-SHA256 signature using webhook secret
}

