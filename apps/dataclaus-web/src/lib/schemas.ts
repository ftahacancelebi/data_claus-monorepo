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
  description: z.string().optional().default(''),
  category: z.string().optional().default(''),
  website_url: z.string().optional(),
  is_active: z.boolean(),
  total_events: z.coerce.number(),
  total_users: z.coerce.number(),
  total_revenue: z.coerce.number(),
  quality_score: z.coerce.number(),
  user_share_percent: z.coerce.number(),
  api_key_prefix: z.string().optional(),
  api_key: z.string().optional(),
  last_event_at: z.string().nullable().optional(),
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

// =============================================================================
// ADMIN
// =============================================================================

export const AdminPlatformStatsSchema = z.object({
  totalUsers: z.coerce.number(),
  totalDevelopers: z.coerce.number(),
  totalApplications: z.coerce.number(),
  totalImpressions: z.coerce.number(),
  totalRevenue: z.coerce.number(),
  platformFees: z.coerce.number(),
  totalTransactions: z.coerce.number(),
});

export const AdminUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string().nullable(),
  walletId: z.string().nullable(),
  qualityScore: z.coerce.number(),
  totalEarned: z.coerce.number(),
  pendingBalance: z.coerce.number(),
  createdAt: z.string(),
});
export const AdminUserListSchema = z.array(AdminUserSchema);

export const LedgerTransactionSchema = z.object({
  id: z.string(),
  source_wallet_id: z.string(),
  dest_wallet_id: z.string(),
  amount: z.coerce.number(),
  currency: z.string(),
  reference_id: z.string().optional(),
  type: z.string(),
  status: z.string(),
  created_at: z.string(),
});
export const LedgerTransactionListSchema = z.array(LedgerTransactionSchema);

export const HealthStatusSchema = z.enum(['green', 'yellow', 'red']);

export const HealthCheckSchema = z.object({
  name: z.string(),
  status: HealthStatusSchema,
  detail: z.string(),
  metric: z.union([z.coerce.number(), z.string(), z.null()]).optional(),
});

export const HealthSummarySchema = z.object({
  status: HealthStatusSchema,
  checkedAt: z.string(),
  checks: z.array(HealthCheckSchema),
});

// =============================================================================
// DEVELOPER + REVENUE CONFIG
// =============================================================================

export const DeveloperResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  user_share_percent: z.coerce.number(),
  dev_share_percent: z.coerce.number(),
});

export const RevenueShareConfigSchema = z.object({
  user_share_percent: z.coerce.number(),
  developer_share_percent: z.coerce.number(),
  platform_fee_percent: z.coerce.number(),
  min_payout_threshold: z.coerce.number(),
});

// =============================================================================
// APPLICATION STATS
// =============================================================================

export const ApplicationStatsSchema = z.object({
  application_id: z.string(),
  total_events: z.coerce.number(),
  total_users: z.coerce.number(),
  total_revenue: z.coerce.number(),
  avg_quality: z.coerce.number(),
  events_today: z.coerce.number(),
  events_week: z.coerce.number(),
  events_month: z.coerce.number(),
});

// =============================================================================
// LEDGER INVARIANT
// =============================================================================

export const LedgerInvariantStatusSchema = z.object({
  ok: z.boolean(),
  net: z.coerce.number(),
  totalRows: z.coerce.number(),
  orphans: z.coerce.number(),
  checkedAt: z.string(),
});

// =============================================================================
// USER IDENTITY LINKING
// =============================================================================

export const DataClausUserSchema = z.object({
  id: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  wallet_id: z.string(),
  quality_score: z.coerce.number(),
  total_earned: z.coerce.number(),
  created_at: z.string(),
});

export const LinkUserResponseSchema = z.object({
  dataclaus_user_id: z.string(),
  user_token: z.string(),
  is_new_user: z.boolean(),
  wallet_id: z.string(),
});

export const UserEarningsResponseSchema = z.object({
  total_earned: z.coerce.number(),
  pending_balance: z.coerce.number(),
  available_balance: z.coerce.number(),
  quality_score: z.coerce.number(),
});

// =============================================================================
// AD REVENUE TRACKING
// =============================================================================

export const AdTypeSchema = z.enum(['banner', 'interstitial', 'rewarded', 'native']);

export const AdConfigSchema = z.object({
  ad_unit_ids: z.object({
    banner: z.string().optional(),
    interstitial: z.string().optional(),
    rewarded: z.string().optional(),
    native: z.string().optional(),
  }),
  enabled: z.boolean(),
  test_mode: z.boolean(),
});

export const AdRevenueSummarySchema = z.object({
  total_impressions: z.coerce.number(),
  total_revenue: z.coerce.number(),
  revenue_by_type: z.record(AdTypeSchema, z.coerce.number()),
  today_revenue: z.coerce.number(),
});

// =============================================================================
// WEBHOOK SECRETS
// =============================================================================

export const WebhookSecretSchema = z.object({
  id: z.string(),
  developer_id: z.string(),
  secret_prefix: z.string(),
  created_at: z.string(),
  last_used_at: z.string().optional(),
});
export const WebhookSecretListSchema = z.array(WebhookSecretSchema);

// =============================================================================
// DATA PACKAGES (Marketplace pivot — spec memory-bank/implementation/08-…)
// =============================================================================

export const PackageStatusSchema = z.enum([
  'pending',
  'evaluating',
  'certified',
  'rejected',
  'sold',
  'delisted',
]);

export const LlmEvaluationSchema = z.object({
  trust_score: z.coerce.number().min(0).max(1),
  summary: z.string(),
  red_flags: z.array(z.string()),
  buyer_match: z.array(z.string()),
  rubric: z.object({
    schema_integrity: z.coerce.number().min(0).max(1),
    sample_diversity: z.coerce.number().min(0).max(1),
    bot_signature_absence: z.coerce.number().min(0).max(1),
    claim_evidence_alignment: z.coerce.number().min(0).max(1),
    price_fairness: z.coerce.number().min(0).max(1),
  }),
  confidence: z.enum(['high', 'medium', 'low']),
  verdict: z.enum(['certified', 'rejected']),
});

export const ClaimedMetricsSchema = z.object({
  row_count: z.coerce.number(),
  unique_users: z.coerce.number(),
  date_range_start: z.string(),
  date_range_end: z.string(),
});

// Use renamed timestamp keys to match TypeORM's snake_case → camelCase boundary:
// the NestJS response wrapper unwraps to entity-shape rows, which DO use camelCase.
export const DataPackageSchema = z.object({
  id: z.string(),
  developerId: z.string(),
  applicationId: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  claimedMetrics: ClaimedMetricsSchema,
  schemaJson: z.record(z.string(), z.string()),
  sampleRows: z.array(z.unknown()),
  price: z.coerce.number(),
  status: PackageStatusSchema,
  dataclausScore: z.coerce.number().nullable(),
  llmEvaluation: LlmEvaluationSchema.nullable(),
  evaluatedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  dimensions: z.lazy(() => DimensionsMapValuedSchema).nullable().optional(),
});

export const DataPackageListMetaSchema = z.object({
  total: z.coerce.number(),
  page: z.coerce.number(),
  limit: z.coerce.number(),
});

export const DataPackageListResponseSchema = z.object({
  data: z.array(DataPackageSchema),
  meta: DataPackageListMetaSchema,
});

export const PackagePurchaseSchema = z.object({
  id: z.string(),
  packageId: z.string(),
  buyerId: z.string(),
  amount: z.coerce.number(),
  ledgerTransactionId: z.string().nullable(),
  downloadToken: z.string().nullable(),
  purchasedAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const PackagePurchaseWithPackageSchema = PackagePurchaseSchema.extend({
  package: DataPackageSchema.nullable(),
});

export const PurchaseResponseSchema = z.object({
  purchase_id: z.string(),
  package_id: z.string(),
  amount: z.coerce.number(),
  download_token: z.string().nullable(),
  ledger_transaction_id: z.string().nullable(),
});

export const CreatePackageResponseSchema = z.object({
  id: z.string(),
  status: PackageStatusSchema,
});

// =============================================================================
// EXTRACTOR — auto-package from app
// =============================================================================

export const EligibleApplicationSchema = z.object({
  id:           z.string().uuid(),
  name:         z.string(),
  category:     z.string().nullable(),
  event_count:  z.number(),
  unique_users: z.number(),
  eligible:     z.boolean(),
  reason:       z.string().optional(),
});
export type EligibleApplication = z.infer<typeof EligibleApplicationSchema>;

export const ExtractedPackageDraftSchema = z.object({
  title:    z.string(),
  category: z.string(),
  claimed_metrics: z.object({
    row_count:         z.number(),
    unique_users:      z.number(),
    date_range_start:  z.string(),
    date_range_end:    z.string(),
  }),
  schema_json:    z.record(z.string(), z.string()),
  sample_rows:    z.array(z.record(z.string(), z.unknown())),
  price:          z.coerce.number(),
  application_id: z.string(),
  ui_meta: z.object({
    application_name:      z.string(),
    suggested_price_basis: z.string(),
    flagged_sample_count:  z.number(),
    coverage_warning:      z.string().optional(),
  }),
  dimensions: z.lazy(() => DimensionsMapSchema).optional(),
});
export type ExtractedPackageDraft = z.infer<typeof ExtractedPackageDraftSchema>;

// ---------------------------------------------------------------------------
// Dimension schemas — multi-dimension data package payloads
// ---------------------------------------------------------------------------

export const DimensionPayloadSchema = z.object({
  count: z.number(),
  sample_rows: z.array(z.record(z.string(), z.unknown())),
  distribution: z.record(z.string(), z.number()).optional(),
  schema_json: z.record(z.string(), z.string()),
});

export const DimensionPayloadValuedSchema = DimensionPayloadSchema.extend({
  unit_price_usd: z.number(),
  quality_score: z.number().min(0).max(1),
  ai_justification: z.string(),
  total_usd: z.number(),
});

export const DimensionsMapSchema = z.object({
  behavior:    DimensionPayloadSchema.optional(),
  demographic: DimensionPayloadSchema.optional(),
  device:      DimensionPayloadSchema.optional(),
});

export const DimensionsMapValuedSchema = z.object({
  behavior:    DimensionPayloadValuedSchema.optional(),
  demographic: DimensionPayloadValuedSchema.optional(),
  device:      DimensionPayloadValuedSchema.optional(),
});

export type DimensionPayload = z.infer<typeof DimensionPayloadSchema>;
export type DimensionPayloadValued = z.infer<typeof DimensionPayloadValuedSchema>;
export type DimensionsMap = z.infer<typeof DimensionsMapSchema>;
export type DimensionsMapValued = z.infer<typeof DimensionsMapValuedSchema>;
