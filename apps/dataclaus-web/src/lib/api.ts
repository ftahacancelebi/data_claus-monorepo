import { z } from 'zod';
import type {
  Wallet,
  Transaction,
  Campaign,
  ScoredEvent,
  ApiKey,
} from './types';
import {
  AdConfigSchema,
  AdminPlatformStatsSchema,
  AdminUserListSchema,
  AdRevenueSummarySchema,
  ApiKeyListSchema,
  ApiKeySchema,
  ApplicationListSchema,
  ApplicationSchema,
  ApplicationStatsSchema,
  CampaignListSchema,
  CampaignSchema,
  CreatePackageResponseSchema,
  DashboardStatsSchema,
  EligibleApplicationSchema,
  ExtractedPackageDraftSchema,
  DataClausUserSchema,
  DataPackageListResponseSchema,
  DataPackageSchema,
  DeveloperResponseSchema,
  EarningsByAppListSchema,
  EarningsSummarySchema,
  HealthSummarySchema,
  LedgerInvariantStatusSchema,
  LedgerPageSchema,
  LedgerTransactionListSchema,
  LinkUserResponseSchema,
  LoginResponseSchema,
  PackagePurchaseSchema,
  PackagePurchaseWithPackageSchema,
  PayoutRecordListSchema,
  PayoutRecordSchema,
  PurchaseResponseSchema,
  QualityHistoryListSchema,
  RevenueShareConfigSchema,
  UserEarningsResponseSchema,
  UserSessionListSchema,
  WalletListSchema,
  WalletSchema,
  WebhookSecretListSchema,
  WebhookSecretSchema,
} from './schemas';

const API_BASE = '/api';

// NestJS response wrapper interface
interface NestJSResponse<T> {
  data: T;
  statusCode: number;
  message: string;
  timestamp: string;
}

/**
 * Typed API error so callers can distinguish 401/403/404/500 from generic failures.
 * Use `error instanceof ApiError && error.status === 401` etc.
 */
export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Sentinel attached to ApiError when a response shape fails its zod schema.
 * Use `error instanceof ApiError && error.status === 0 && error.body?.kind === 'schema'`
 * if you need to distinguish schema drift from network errors.
 */
export class SchemaValidationError extends ApiError {
  zodIssues: unknown;
  constructor(endpoint: string, issues: unknown) {
    super(0, `Response shape mismatch for ${endpoint}`, {
      kind: 'schema',
      issues,
    });
    this.name = 'SchemaValidationError';
    this.zodIssues = issues;
  }
}

interface RequestExtras<T> {
  schema?: z.ZodType<T>;
}

async function request<T>(
  endpoint: string,
  options?: RequestInit & RequestExtras<T>
): Promise<T> {
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

  // Strip `schema` from options before handing off to fetch
  const { schema, ...fetchOptions } = options ?? {};

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...fetchOptions,
    headers,
    // Include the dc_session cookie so the backend's JwtStrategy cookie
    // extractor can authenticate when the Bearer header is absent (e.g.,
    // after we eventually retire localStorage tokens). Same-origin in dev
    // via the Next.js /api → backend rewrite, so no CORS surprise.
    credentials: 'include',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' }));
    const message =
      (body && (body.error || body.message)) || `Request failed (${res.status})`;
    // Throw a typed error; pages handle it locally (toast / error state / retry).
    // We deliberately do NOT auto-logout on 401 — a transient 401 should not
    // kick the user out. Logout is reserved for explicit user action and for
    // failed session-validation calls (`/auth/me`) made from RequireAuth.
    throw new ApiError(res.status, message, body);
  }

  const json = await res.json();
  // Handle NestJS wrapped response format
  const payload =
    json && typeof json === 'object' && 'data' in json && 'statusCode' in json
      ? (json as { data: unknown }).data
      : json;

  // Optional runtime validation. Throws SchemaValidationError on drift, which
  // bubbles up to the route segment's error.tsx if uncaught.
  if (schema) {
    const result = schema.safeParse(payload);
    if (!result.success) {
      throw new SchemaValidationError(endpoint, result.error.issues);
    }
    return result.data;
  }

  return payload as T;
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

/**
 * Tells the backend to clear the dc_session cookie. Idempotent and safe to
 * call even when the user's session is already invalid — the endpoint just
 * resets the cookie regardless. Called from auth-context.logout().
 */
export const apiLogout = () =>
  request<{ status: string }>('/auth/logout', { method: 'POST' }).catch(
    () => ({ status: 'error' }), // swallow — local cleanup runs anyway
  );

// Login returns NestJS format with accessToken and user object
export const loginUser = async (email: string, password: string): Promise<{
  id: string;
  email: string;
  name: string;
  role: string;
  token: string;
}> => {
  const response = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    schema: LoginResponseSchema,
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
  request(`/developers/${id}`, {
    schema: DeveloperResponseSchema,
  }) as Promise<DeveloperResponse>;

export const updateDeveloperUserShare = (
  id: string,
  userSharePercent: number
) =>
  request(`/developers/${id}/user-share`, {
    method: 'PUT',
    body: JSON.stringify({ user_share_percent: userSharePercent }),
    schema: DeveloperResponseSchema,
  }) as Promise<DeveloperResponse>;

export const generateApiKey = (developerId: string, name: string) =>
  request(`/developers/${developerId}/api-keys`, {
    method: 'POST',
    body: JSON.stringify({ name }),
    schema: ApiKeySchema,
  }) as Promise<ApiKey & { raw_key: string }>;

export const listApiKeys = (developerId: string) =>
  request(`/developers/${developerId}/api-keys`, {
    schema: ApiKeyListSchema,
  }) as Promise<ApiKey[]>;

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

export const getWallet = (id: string) =>
  request(`/wallets/${id}`, { schema: WalletSchema }) as Promise<Wallet>;

export const getWalletsByOwner = (ownerId: string) =>
  request(`/wallets/owner/${ownerId}`, {
    schema: WalletListSchema,
  }) as Promise<Wallet[]>;

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
  description?: string;
  budget: number;
  bid_per_impression?: number;
  targeting?: {
    appCategories?: string[];
    countries?: string[];
    minQualityScore?: number;
    deviceTypes?: ('ios' | 'android')[];
  };
  starts_at?: string;
  ends_at?: string;
}) =>
  request('/campaigns', {
    method: 'POST',
    body: JSON.stringify(data),
    schema: CampaignSchema,
  }) as Promise<Campaign>;

export const pauseCampaign = (id: string) =>
  request(`/campaigns/${id}/pause`, {
    method: 'POST',
    schema: CampaignSchema,
  }) as Promise<Campaign>;

export const resumeCampaign = (id: string) =>
  request(`/campaigns/${id}/resume`, {
    method: 'POST',
    schema: CampaignSchema,
  }) as Promise<Campaign>;

export const getCampaigns = () =>
  request('/campaigns', { schema: CampaignListSchema }) as Promise<Campaign[]>;

export const getCampaign = (id: string) =>
  request(`/campaigns/${id}`, { schema: CampaignSchema }) as Promise<Campaign>;

export const getCampaignsByBuyer = (buyerId: string) =>
  request(`/campaigns/buyer/${buyerId}`, {
    schema: CampaignListSchema,
  }) as Promise<Campaign[]>;

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
  request('/analytics/dashboard', {
    schema: DashboardStatsSchema,
  });

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
  request('/config/revenue-shares', {
    schema: RevenueShareConfigSchema,
  }) as Promise<RevenueShareConfig>;

// Release pending balance
export const releasePendingBalance = (walletId: string) =>
  request<{ status: string; released: number }>(
    `/wallets/${walletId}/release-pending`,
    {
      method: 'POST',
    }
  );

// Payouts (Phase 2 - Financial Integrity)
export type PayoutMethod = 'bank_simulation' | 'crypto_simulation';
export type PayoutStatus =
  | 'requested'
  | 'approved'
  | 'completed'
  | 'rejected'
  | 'failed';

export interface PayoutRecord {
  id: string;
  user_id: string;
  wallet_id: string;
  amount: number;
  currency: string;
  method: PayoutMethod;
  status: PayoutStatus;
  requested_at: string;
  approved_at: string | null;
  completed_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  metadata: Record<string, unknown> | null;
}

export const requestPayout = (data: {
  amount: number;
  method: PayoutMethod;
  destination?: string;
}) =>
  request(`/payouts/request`, {
    method: 'POST',
    body: JSON.stringify(data),
    schema: PayoutRecordSchema,
  }) as Promise<PayoutRecord>;

export const listMyPayouts = () =>
  request('/payouts/me', {
    schema: PayoutRecordListSchema,
  }) as Promise<PayoutRecord[]>;

export const getPayout = (id: string) =>
  request(`/payouts/${id}`, { schema: PayoutRecordSchema }) as Promise<PayoutRecord>;

export interface LedgerInvariantStatus {
  ok: boolean;
  net: number;
  totalRows: number;
  orphans: number;
  checkedAt: string;
}

export const checkLedgerInvariant = () =>
  request('/admin/ledger/invariant', {
    schema: LedgerInvariantStatusSchema,
  }) as Promise<LedgerInvariantStatus>;

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
  request(`/developers/${developerId}/applications`, {
    method: 'POST',
    body: JSON.stringify(data),
    schema: ApplicationSchema,
  }) as Promise<Application>;

export const getApplications = (developerId: string) =>
  request(`/developers/${developerId}/applications`, {
    schema: ApplicationListSchema,
  }) as Promise<Application[]>;

export const getApplication = (id: string) =>
  request(`/applications/${id}`, {
    schema: ApplicationSchema,
  }) as Promise<Application>;

export const getApplicationStats = (id: string) =>
  request(`/applications/${id}/stats`, {
    schema: ApplicationStatsSchema,
  }) as Promise<ApplicationStats>;

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
  request(`/applications/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    schema: ApplicationSchema,
  }) as Promise<Application>;

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
  request(`/applications/${applicationId}/users/link`, {
    method: 'POST',
    body: JSON.stringify(data),
    schema: LinkUserResponseSchema,
  }) as Promise<LinkUserResponse>;

export const getUserByExternalId = (applicationId: string, externalUserId: string) =>
  request(`/applications/${applicationId}/users/external/${externalUserId}`, {
    schema: DataClausUserSchema,
  }) as Promise<DataClausUser>;

export const getUserEarnings = (userId: string) =>
  request(`/users/${userId}/earnings`, {
    schema: UserEarningsResponseSchema,
  }) as Promise<{
    total_earned: number;
    pending_balance: number;
    available_balance: number;
    quality_score: number;
  }>;

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
  request(`/applications/${applicationId}/ads/config`, {
    schema: AdConfigSchema,
  }) as Promise<AdConfig>;

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
  request(`/applications/${applicationId}/ads/summary`, {
    schema: AdRevenueSummarySchema,
  }) as Promise<{
    total_impressions: number;
    total_revenue: number;
    revenue_by_type: Record<AdType, number>;
    today_revenue: number;
  }>;

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
  request(`/developers/${developerId}/webhook-secrets`, {
    schema: WebhookSecretListSchema,
  }) as Promise<WebhookSecret[]>;

export const revokeWebhookSecret = (developerId: string, secretId: string) =>
  request<{ status: string }>(`/developers/${developerId}/webhook-secrets/${secretId}`, {
    method: 'DELETE',
  });

// ============================================================
// USER PORTAL (/me/*) — Phase 5
// ============================================================

export interface EarningsByApp {
  applicationId: string;
  appName: string;
  category: string | null;
  totalEarned: number;
  last7Days: number;
  qualityScoreAvg: number;
  impressionCount: number;
}

export interface LedgerEntry {
  id: string;
  date: string;
  type: string;
  amount: number;
  currency: string;
  applicationId: string | null;
  applicationName: string | null;
  status: string;
  referenceId: string | null;
}

export interface LedgerPage {
  items: LedgerEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface QualityHistoryPoint {
  date: string;
  averageQuality: number;
  earnings: number;
  impressions: number;
}

export interface UserSession {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastActiveAt: string;
  isCurrent: boolean;
}

export const getMyEarningsByApp = () =>
  request('/me/earnings/by-app', {
    schema: EarningsByAppListSchema,
  }) as Promise<EarningsByApp[]>;

export const getMyLedger = (params?: {
  from?: string;
  to?: string;
  type?: string;
  applicationId?: string;
  page?: number;
  pageSize?: number;
}) => {
  const search = new URLSearchParams();
  if (params?.from) search.set('from', params.from);
  if (params?.to) search.set('to', params.to);
  if (params?.type) search.set('type', params.type);
  if (params?.applicationId) search.set('applicationId', params.applicationId);
  if (params?.page) search.set('page', String(params.page));
  if (params?.pageSize) search.set('pageSize', String(params.pageSize));
  const qs = search.toString();
  return request(`/me/ledger${qs ? `?${qs}` : ''}`, {
    schema: LedgerPageSchema,
  }) as Promise<LedgerPage>;
};

export const getMyQualityHistory = (days = 30) =>
  request(`/me/quality-score-history?days=${days}`, {
    schema: QualityHistoryListSchema,
  }) as Promise<QualityHistoryPoint[]>;

export const getMySessions = () =>
  request('/me/sessions', {
    schema: UserSessionListSchema,
  }) as Promise<UserSession[]>;

export const revokeMySession = (id: string) =>
  request<{ status: string }>(`/me/sessions/${id}`, { method: 'DELETE' });

export const revokeAllMySessions = () =>
  request<{ status: string }>('/me/sessions', { method: 'DELETE' });

export const getMyEarningsSummary = () =>
  request('/users/me/earnings', {
    schema: EarningsSummarySchema,
  }) as Promise<{
    userId: string;
    walletId: string | null;
    balance: number;
    pendingBalance: number;
    totalEarned: number;
    currency: string;
  }>;

export const requestAccountDeletion = () =>
  request<{ status: string }>('/me/account/delete-request', { method: 'POST' });

export const cancelAccountDeletion = () =>
  request<void>('/me/account/delete-request', { method: 'DELETE' });

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

// ============================================================
// ADMIN  (admin role only — gated server-side; client-side too via RequireRole)
// ============================================================

export interface AdminPlatformStats {
  totalUsers: number;
  totalDevelopers: number;
  totalApplications: number;
  totalImpressions: number;
  totalRevenue: number;
  platformFees: number;
  totalTransactions: number;
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  walletId: string | null;
  qualityScore: number;
  totalEarned: number;
  pendingBalance: number;
  createdAt: string;
}

export interface LedgerTransaction {
  id: string;
  source_wallet_id: string;
  dest_wallet_id: string;
  amount: number;
  currency: string;
  reference_id?: string;
  type: string;
  status: string;
  created_at: string;
}

export type HealthStatus = 'green' | 'yellow' | 'red';

export interface HealthCheck {
  name: string;
  status: HealthStatus;
  detail: string;
  metric?: number | string | null;
}

export interface HealthSummary {
  status: HealthStatus;
  checkedAt: string;
  checks: HealthCheck[];
}

export const getAdminStats = () =>
  request('/admin/stats', {
    schema: AdminPlatformStatsSchema,
  }) as Promise<AdminPlatformStats>;

export const getAdminUsers = () =>
  request('/admin/users', {
    schema: AdminUserListSchema,
  }) as Promise<AdminUser[]>;

export const getLedgerEntries = () =>
  request('/ledger', {
    schema: LedgerTransactionListSchema,
  }) as Promise<LedgerTransaction[]>;

export const getAdminHealth = () =>
  request('/admin/health/full', {
    schema: HealthSummarySchema,
    cache: 'no-store',
  }) as Promise<HealthSummary>;

// =============================================================================
// DATA PACKAGES (Marketplace pivot)
// =============================================================================

export type DataPackage = z.infer<typeof DataPackageSchema>;
export type PackagePurchase = z.infer<typeof PackagePurchaseSchema>;
export type PackagePurchaseWithPackage = z.infer<
  typeof PackagePurchaseWithPackageSchema
>;
export type PurchaseResponse = z.infer<typeof PurchaseResponseSchema>;
export type CreatePackageResponse = z.infer<typeof CreatePackageResponseSchema>;

export interface PackageListFilters {
  category?: string;
  min_score?: number;
  max_price?: number;
  page?: number;
  limit?: number;
}

export interface CreatePackageInput {
  title: string;
  category: string;
  description?: string;
  claimed_metrics: {
    row_count: number;
    unique_users: number;
    date_range_start: string;
    date_range_end: string;
  };
  schema_json: Record<string, string>;
  sample_rows: Record<string, unknown>[];
  price: number;
  application_id?: string;
}

function buildPackagesQuery(filters?: PackageListFilters): string {
  if (!filters) return '';
  const qs = new URLSearchParams();
  if (filters.category) qs.set('category', filters.category);
  if (typeof filters.min_score === 'number')
    qs.set('min_score', String(filters.min_score));
  if (typeof filters.max_price === 'number')
    qs.set('max_price', String(filters.max_price));
  if (filters.page) qs.set('page', String(filters.page));
  if (filters.limit) qs.set('limit', String(filters.limit));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const listPackages = (filters?: PackageListFilters) =>
  request(`/v1/packages${buildPackagesQuery(filters)}`, {
    schema: DataPackageListResponseSchema,
  });

export const getPackage = (id: string) =>
  request(`/v1/packages/${id}`, {
    schema: DataPackageSchema,
  });

export const listMyPackages = () =>
  // Endpoint returns a bare array (no list-meta), so we wrap with z.array.
  request(`/v1/packages/mine`, {
    schema: z.array(DataPackageSchema),
  });

export const listMyPurchases = () =>
  request(`/v1/packages/purchases`, {
    schema: z.array(PackagePurchaseWithPackageSchema),
  });

export const listAllPackagesAdmin = () =>
  request(`/v1/packages/admin/all`, {
    schema: z.array(DataPackageSchema),
  });

export const createPackage = (input: CreatePackageInput) =>
  request(`/v1/packages`, {
    method: 'POST',
    body: JSON.stringify(input),
    schema: CreatePackageResponseSchema,
  });

export const purchasePackage = (id: string) =>
  request(`/v1/packages/${id}/purchase`, {
    method: 'POST',
    body: JSON.stringify({}),
    schema: PurchaseResponseSchema,
  });

export const reevaluatePackage = (id: string) =>
  request(`/v1/packages/${id}/reevaluate`, {
    method: 'POST',
    body: JSON.stringify({}),
    schema: CreatePackageResponseSchema,
  });

export const delistPackage = (id: string) =>
  request(`/v1/packages/${id}/delist`, {
    method: 'POST',
    body: JSON.stringify({}),
    schema: CreatePackageResponseSchema,
  });

// =============================================================================
// EXTRACTOR — auto-package from app
// =============================================================================

export const listEligibleApplications = () =>
  request('/v1/packages/extract/eligible-apps', {
    schema: z.array(EligibleApplicationSchema),
  });

export const extractPackagePreview = (
  appId: string,
  opts?: { from?: string; to?: string },
) => {
  const qs = new URLSearchParams();
  if (opts?.from) qs.set('from', opts.from);
  if (opts?.to)   qs.set('to',   opts.to);
  const query = qs.toString() ? `?${qs}` : '';
  return request(`/v1/packages/extract/preview/${appId}${query}`, {
    schema: ExtractedPackageDraftSchema,
  });
};

