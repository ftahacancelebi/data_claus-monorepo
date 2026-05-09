/**
 * Runtime schemas for API responses.
 *
 * Why: TypeScript types don't survive `JSON.parse`. When the backend renames
 * a field, drops a column, or returns a string where a number used to be,
 * the frontend silently sees `undefined` and renders `$NaN`. Schemas catch
 * the drift at the boundary, throw a typed error, and surface it through
 * `error.tsx` boundaries instead of corrupting state.
 *
 * Conventions:
 * - Money values use `z.coerce.number()` because Postgres NUMERIC columns
 *   come over the wire as strings ("0.0000") in some endpoints.
 * - Optional fields use `.optional()`, nullable use `.nullable()`. We treat
 *   `undefined` and `null` as semantically different (NestJS sends `null`).
 * - We do NOT use `.strict()` — extra keys from API evolution shouldn't break
 *   old clients. We only validate keys we read.
 *
 * If a callsite needs a different shape, define a partial schema and pass
 * it inline at the request site, rather than weakening the canonical schema.
 */

import { z } from 'zod';

// =============================================================================
// AUTH
// =============================================================================

export const UserRoleSchema = z.enum(['user', 'developer', 'buyer', 'admin']);

export const AuthUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: UserRoleSchema,
});

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    role: z.string(),
  }),
});

// =============================================================================
// MONEY / EARNINGS
// =============================================================================

export const EarningsSummarySchema = z.object({
  userId: z.string(),
  walletId: z.string().nullable(),
  balance: z.coerce.number(),
  pendingBalance: z.coerce.number(),
  totalEarned: z.coerce.number(),
  currency: z.string(),
});

export const EarningsByAppSchema = z.object({
  applicationId: z.string(),
  appName: z.string(),
  category: z.string().nullable(),
  totalEarned: z.coerce.number(),
  last7Days: z.coerce.number(),
  qualityScoreAvg: z.coerce.number(),
  impressionCount: z.coerce.number(),
});
export const EarningsByAppListSchema = z.array(EarningsByAppSchema);

export const QualityHistoryPointSchema = z.object({
  date: z.string(),
  averageQuality: z.coerce.number(),
  earnings: z.coerce.number(),
  impressions: z.coerce.number(),
});
export const QualityHistoryListSchema = z.array(QualityHistoryPointSchema);

// =============================================================================
// PAYOUTS
// =============================================================================

export const PayoutMethodSchema = z.enum([
  'bank_simulation',
  'crypto_simulation',
]);

export const PayoutStatusSchema = z.enum([
  'requested',
  'approved',
  'completed',
  'rejected',
  'failed',
]);

export const PayoutRecordSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  wallet_id: z.string(),
  amount: z.coerce.number(),
  currency: z.string(),
  method: PayoutMethodSchema,
  status: PayoutStatusSchema,
  requested_at: z.string(),
  approved_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  rejected_at: z.string().nullable(),
  rejection_reason: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});
export const PayoutRecordListSchema = z.array(PayoutRecordSchema);

// =============================================================================
// LEDGER
// =============================================================================

export const LedgerEntrySchema = z.object({
  id: z.string(),
  date: z.string(),
  type: z.string(),
  amount: z.coerce.number(),
  currency: z.string(),
  applicationId: z.string().nullable(),
  applicationName: z.string().nullable(),
  status: z.string(),
  referenceId: z.string().nullable(),
});

export const LedgerPageSchema = z.object({
  items: z.array(LedgerEntrySchema),
  total: z.coerce.number(),
  page: z.coerce.number(),
  pageSize: z.coerce.number(),
});

// =============================================================================
// SESSIONS
// =============================================================================

export const UserSessionSchema = z.object({
  id: z.string(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  lastActiveAt: z.string(),
  isCurrent: z.boolean(),
});
export const UserSessionListSchema = z.array(UserSessionSchema);

// =============================================================================
// API KEYS
// =============================================================================

export const ApiKeySchema = z.object({
  id: z.string(),
  developer_id: z.string().optional(),
  key_prefix: z.string(),
  name: z.string(),
  is_active: z.boolean(),
  last_used_at: z.string().optional(),
  created_at: z.string(),
  raw_key: z.string().optional(),
});
export const ApiKeyListSchema = z.array(ApiKeySchema);

// =============================================================================
// APPLICATIONS
// =============================================================================

export const ApplicationSchema = z.object({
  id: z.string(),
  developer_id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  website_url: z.string(),
  is_active: z.boolean(),
  total_events: z.coerce.number(),
  total_users: z.coerce.number(),
  total_revenue: z.coerce.number(),
  quality_score: z.coerce.number(),
  user_share_percent: z.coerce.number(),
  api_key_prefix: z.string().optional(),
  api_key: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export const ApplicationListSchema = z.array(ApplicationSchema);

// =============================================================================
// CAMPAIGNS
// =============================================================================

export const CampaignSchema = z.object({
  id: z.string(),
  buyer_id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  total_budget: z.coerce.number(),
  budget: z.coerce.number().optional(),
  remaining: z.coerce.number(),
  spent_budget: z.coerce.number().optional(),
  bid_per_impression: z.coerce.number().optional(),
  targeting: z
    .object({
      appCategories: z.array(z.string()).optional(),
      countries: z.array(z.string()).optional(),
      minQualityScore: z.coerce.number().optional(),
      deviceTypes: z.array(z.enum(['ios', 'android'])).optional(),
    })
    .optional(),
  status: z.string(),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  impressions_served: z.coerce.number().optional(),
  unique_users_reached: z.coerce.number().optional(),
  created_at: z.string(),
});
export const CampaignListSchema = z.array(CampaignSchema);

// =============================================================================
// WALLETS
// =============================================================================

export const WalletSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  type: z.string(),
  balance: z.coerce.number(),
  pending_balance: z.coerce.number(),
  currency: z.string(),
  created_at: z.string(),
});
export const WalletListSchema = z.array(WalletSchema);

// =============================================================================
// DASHBOARD STATS (developer dashboard)
// =============================================================================

export const DashboardStatsSchema = z.object({
  total_events: z.coerce.number(),
  total_users: z.coerce.number(),
  total_developers: z.coerce.number(),
  average_quality: z.coerce.number(),
  total_payouts: z.coerce.number(),
  active_campaigns: z.coerce.number(),
});
