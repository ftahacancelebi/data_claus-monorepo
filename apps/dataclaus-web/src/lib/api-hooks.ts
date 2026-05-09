'use client';

/**
 * React Query hooks layer.
 *
 * Wraps the imperative `lib/api.ts` callsites so pages can:
 *   - read server data through `useX()` hooks (cached, deduped, refetched
 *     on focus, automatically retried)
 *   - mutate through `useDoX()` hooks that co-locate `invalidateQueries`
 *     for every cache key they touch
 *
 * All mutations follow the "list invalidations next to the mutation" rule
 * from `senior-frontend-flow`. If you add a new mutation, declare every
 * cache key it makes stale here, not at callsites.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';

import {
  // earnings & payouts
  getMyEarningsByApp,
  getMyEarningsSummary,
  getMyQualityHistory,
  listMyPayouts,
  requestPayout,
  getMyLedger,
  // sessions / account
  getMySessions,
  revokeMySession,
  revokeAllMySessions,
  requestAccountDeletion,
  cancelAccountDeletion,
  // api keys
  generateApiKey,
  listApiKeys,
  revokeApiKey,
  // applications
  createApplication,
  getApplications,
  getApplication,
  getApplicationStats,
  updateApplication,
  toggleApplicationStatus,
  deleteApplication,
  // campaigns
  createCampaign,
  getCampaigns,
  getCampaign,
  getCampaignsByBuyer,
  updateCampaignStatus,
  pauseCampaign,
  resumeCampaign,
  // wallets
  getWalletsByOwner,
  getWalletTransactions,
  creditWallet,
  releasePendingBalance,
  getRevenueShares,
  // dashboard
  getDashboard,
  // types
  type EarningsByApp,
  type QualityHistoryPoint,
  type PayoutRecord,
  type UserSession,
  type LedgerPage,
  type Application,
  type ApplicationStats,
  type DashboardStats,
} from './api';
import { queryKeys } from './query-keys';
import type { ApiKey, Campaign, Wallet, Transaction } from './types';
import type { RevenueShareConfig } from './api';

// =============================================================================
// EARNINGS & PAYOUTS  (end-user portal)
// =============================================================================

export interface EarningsSummary {
  userId: string;
  walletId: string | null;
  balance: number;
  pendingBalance: number;
  totalEarned: number;
  currency: string;
}

export function useEarningsSummary(
  options?: Omit<UseQueryOptions<EarningsSummary>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.earnings.summary(),
    queryFn: () => getMyEarningsSummary() as Promise<EarningsSummary>,
    ...options,
  });
}

export function useEarningsByApp(
  options?: Omit<UseQueryOptions<EarningsByApp[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.earnings.byApp(),
    queryFn: getMyEarningsByApp,
    ...options,
  });
}

export function useQualityHistory(
  days = 30,
  options?: Omit<UseQueryOptions<QualityHistoryPoint[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.earnings.qualityHistory(days),
    queryFn: () => getMyQualityHistory(days),
    ...options,
  });
}

export function useMyPayouts(
  options?: Omit<UseQueryOptions<PayoutRecord[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.payouts.list(),
    queryFn: listMyPayouts,
    ...options,
  });
}

export function useRequestPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: requestPayout,
    onSuccess: () => {
      // Payout requested: balance changes, history grows.
      qc.invalidateQueries({ queryKey: queryKeys.earnings.all });
      qc.invalidateQueries({ queryKey: queryKeys.payouts.all });
      qc.invalidateQueries({ queryKey: queryKeys.ledger.all });
    },
  });
}

export function useMyLedger(
  params?: Parameters<typeof getMyLedger>[0],
  options?: Omit<UseQueryOptions<LedgerPage>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.ledger.page(params as Record<string, unknown> | undefined),
    queryFn: () => getMyLedger(params),
    ...options,
  });
}

// =============================================================================
// SESSIONS & ACCOUNT
// =============================================================================

export function useMySessions(
  options?: Omit<UseQueryOptions<UserSession[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.sessions.list(),
    queryFn: getMySessions,
    ...options,
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => revokeMySession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sessions.all });
    },
  });
}

export function useRevokeAllSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: revokeAllMySessions,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sessions.all });
    },
  });
}

export function useRequestAccountDeletion() {
  return useMutation({ mutationFn: requestAccountDeletion });
}

export function useCancelAccountDeletion() {
  return useMutation({ mutationFn: cancelAccountDeletion });
}

// =============================================================================
// API KEYS  (developer portal)
// =============================================================================

export function useApiKeys(
  developerId: string | undefined,
  options?: Omit<UseQueryOptions<ApiKey[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.apiKeys.byDeveloper(developerId ?? ''),
    queryFn: () => listApiKeys(developerId as string),
    enabled: Boolean(developerId),
    ...options,
  });
}

export function useGenerateApiKey(developerId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => generateApiKey(developerId as string, name),
    onSuccess: () => {
      if (developerId) {
        qc.invalidateQueries({
          queryKey: queryKeys.apiKeys.byDeveloper(developerId),
        });
      }
    },
  });
}

export function useRevokeApiKey(developerId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) => revokeApiKey(developerId as string, keyId),
    onSuccess: () => {
      if (developerId) {
        qc.invalidateQueries({
          queryKey: queryKeys.apiKeys.byDeveloper(developerId),
        });
      }
    },
  });
}

// =============================================================================
// APPLICATIONS  (developer portal)
// =============================================================================

export function useApplications(
  developerId: string | undefined,
  options?: Omit<UseQueryOptions<Application[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.applications.byDeveloper(developerId ?? ''),
    queryFn: () => getApplications(developerId as string),
    enabled: Boolean(developerId),
    ...options,
  });
}

export function useApplication(
  id: string | undefined,
  options?: Omit<UseQueryOptions<Application>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.applications.detail(id ?? ''),
    queryFn: () => getApplication(id as string),
    enabled: Boolean(id),
    ...options,
  });
}

export function useApplicationStats(
  id: string | undefined,
  options?: Omit<UseQueryOptions<ApplicationStats>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.applications.stats(id ?? ''),
    queryFn: () => getApplicationStats(id as string),
    enabled: Boolean(id),
    ...options,
  });
}

export function useCreateApplication(developerId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createApplication>[1]) =>
      createApplication(developerId as string, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.applications.all });
    },
  });
}

export function useUpdateApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateApplication>[1];
    }) => updateApplication(id, data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.applications.all });
      qc.invalidateQueries({
        queryKey: queryKeys.applications.detail(vars.id),
      });
    },
  });
}

export function useToggleApplicationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleApplicationStatus(id, isActive),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.applications.all });
    },
  });
}

export function useDeleteApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteApplication(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.applications.all });
    },
  });
}

// =============================================================================
// CAMPAIGNS  (buyer portal)
// =============================================================================

export function useCampaignsByBuyer(
  buyerId: string | undefined,
  options?: Omit<UseQueryOptions<Campaign[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.campaigns.byBuyer(buyerId ?? ''),
    queryFn: () => getCampaignsByBuyer(buyerId as string),
    enabled: Boolean(buyerId),
    ...options,
  });
}

export function useCampaigns(
  options?: Omit<UseQueryOptions<Campaign[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.campaigns.all,
    queryFn: getCampaigns,
    ...options,
  });
}

export function useCampaign(
  id: string | undefined,
  options?: Omit<UseQueryOptions<Campaign>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.campaigns.detail(id ?? ''),
    queryFn: () => getCampaign(id as string),
    enabled: Boolean(id),
    ...options,
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCampaign,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.campaigns.all });
      // Wallet balance changes when budget is reserved
      qc.invalidateQueries({ queryKey: queryKeys.wallets.all });
    },
  });
}

export function useUpdateCampaignStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateCampaignStatus(id, status),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.campaigns.all });
      qc.invalidateQueries({
        queryKey: queryKeys.campaigns.detail(vars.id),
      });
    },
  });
}

export function usePauseCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pauseCampaign(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.campaigns.all });
    },
  });
}

export function useResumeCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => resumeCampaign(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.campaigns.all });
    },
  });
}

// =============================================================================
// WALLETS
// =============================================================================

export function useWalletsByOwner(
  ownerId: string | undefined,
  options?: Omit<UseQueryOptions<Wallet[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.wallets.byOwner(ownerId ?? ''),
    queryFn: () => getWalletsByOwner(ownerId as string),
    enabled: Boolean(ownerId),
    ...options,
  });
}

export function useCreditWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      creditWallet(id, amount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.wallets.all });
      qc.invalidateQueries({ queryKey: queryKeys.earnings.all });
    },
  });
}

export function useWalletTransactions(
  walletId: string | undefined,
  opts?: { limit?: number; offset?: number },
  options?: Omit<UseQueryOptions<Transaction[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [
      ...queryKeys.wallets.byOwner(walletId ?? ''),
      'transactions',
      opts?.limit ?? 10,
      opts?.offset ?? 0,
    ],
    queryFn: () =>
      getWalletTransactions(
        walletId as string,
        opts?.limit ?? 10,
        opts?.offset ?? 0,
      ),
    enabled: Boolean(walletId),
    ...options,
  });
}

export function useReleasePendingBalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (walletId: string) => releasePendingBalance(walletId),
    onSuccess: () => {
      // Pending → balance: invalidate wallets + earnings + ledger
      qc.invalidateQueries({ queryKey: queryKeys.wallets.all });
      qc.invalidateQueries({ queryKey: queryKeys.earnings.all });
      qc.invalidateQueries({ queryKey: queryKeys.ledger.all });
    },
  });
}

export function useRevenueShares(
  options?: Omit<UseQueryOptions<RevenueShareConfig>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['config', 'revenue-shares'],
    queryFn: getRevenueShares,
    // Revenue share config is stable for hours; cache aggressively.
    staleTime: 5 * 60_000,
    ...options,
  });
}

// =============================================================================
// DASHBOARD STATS
// =============================================================================

export function useDashboardStats(
  options?: Omit<UseQueryOptions<DashboardStats>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: getDashboard,
    ...options,
  });
}
