/**
 * Centralized query key factory.
 *
 * Why a factory: hand-built query key strings drift over time. A typo in one
 * page breaks invalidation from another page in a way that's invisible until a
 * user reports "I edited X but the list still shows the old value".
 *
 * Pattern:
 *   - `all` is the broadest key for a domain — invalidate it after any mutation
 *     that may affect anything in the domain ("nuke the cache for X").
 *   - Individual factories build narrower keys; they all start with `all` so
 *     a single broad invalidation hits them.
 *
 * Usage:
 *   queryKey: queryKeys.earnings.summary()
 *   qc.invalidateQueries({ queryKey: queryKeys.earnings.all })  // broad
 *   qc.invalidateQueries({ queryKey: queryKeys.earnings.summary() })  // narrow
 */

export const queryKeys = {
  earnings: {
    all: ['earnings'] as const,
    summary: () => [...queryKeys.earnings.all, 'summary'] as const,
    byApp: () => [...queryKeys.earnings.all, 'by-app'] as const,
    qualityHistory: (days: number) =>
      [...queryKeys.earnings.all, 'quality-history', days] as const,
  },
  payouts: {
    all: ['payouts'] as const,
    list: () => [...queryKeys.payouts.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.payouts.all, 'detail', id] as const,
  },
  ledger: {
    all: ['ledger'] as const,
    page: (params?: Record<string, unknown>) =>
      [...queryKeys.ledger.all, 'page', params ?? {}] as const,
  },
  sessions: {
    all: ['sessions'] as const,
    list: () => [...queryKeys.sessions.all, 'list'] as const,
  },
  apiKeys: {
    all: ['api-keys'] as const,
    byDeveloper: (developerId: string) =>
      [...queryKeys.apiKeys.all, developerId] as const,
  },
  applications: {
    all: ['applications'] as const,
    byDeveloper: (developerId: string) =>
      [...queryKeys.applications.all, 'developer', developerId] as const,
    detail: (id: string) =>
      [...queryKeys.applications.all, 'detail', id] as const,
    stats: (id: string) =>
      [...queryKeys.applications.all, 'stats', id] as const,
  },
  campaigns: {
    all: ['campaigns'] as const,
    byBuyer: (buyerId: string) =>
      [...queryKeys.campaigns.all, 'buyer', buyerId] as const,
    detail: (id: string) =>
      [...queryKeys.campaigns.all, 'detail', id] as const,
  },
  wallets: {
    all: ['wallets'] as const,
    byOwner: (ownerId: string) =>
      [...queryKeys.wallets.all, 'owner', ownerId] as const,
  },
  dashboard: {
    stats: () => ['dashboard', 'stats'] as const,
  },
} as const;
