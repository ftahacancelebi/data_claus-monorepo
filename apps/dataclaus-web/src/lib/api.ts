import type {
  Wallet,
  Transaction,
  Campaign,
  ScoredEvent,
  ApiKey,
} from './types';

const API_BASE = '/api';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || 'Request failed');
  }
  return res.json();
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

export const loginUser = (email: string, password: string) =>
  request<{
    id: string;
    email: string;
    name: string;
    role: string;
    token: string;
  }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

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
