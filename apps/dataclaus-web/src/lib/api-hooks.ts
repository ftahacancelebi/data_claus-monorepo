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
  // admin
  getAdminStats,
  getAdminUsers,
  getLedgerEntries,
  getAdminHealth,
  // extractor
  listEligibleApplications,
  extractPackagePreview,
  // packages
  listPackages,
  listMyPackages,
  listMyPurchases,
  listAllPackagesAdmin,
  getPackage,
  createPackage,
  purchasePackage,
  reevaluatePackage,
  delistPackage,
  type DataPackage,
  type PackagePurchaseWithPackage,
  type PackageListFilters,
  type CreatePackageInput,
  type CreatePackageResponse,
  type PurchaseResponse,
  // types
  type EarningsByApp,
  type QualityHistoryPoint,
  type PayoutRecord,
  type UserSession,
  type LedgerPage,
  type Application,
  type ApplicationStats,
  type DashboardStats,
  type AdminPlatformStats,
  type AdminUser,
  type LedgerTransaction,
  type HealthSummary,
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

// =============================================================================
// ADMIN  (gated by RequireRole role="admin" at the route layer)
// =============================================================================

export function useAdminStats(
  options?: Omit<UseQueryOptions<AdminPlatformStats>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.admin.stats(),
    queryFn: getAdminStats,
    ...options,
  });
}

export function useAdminUsers(
  options?: Omit<UseQueryOptions<AdminUser[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.admin.users(),
    queryFn: getAdminUsers,
    ...options,
  });
}

export function useLedgerEntries(
  options?: Omit<UseQueryOptions<LedgerTransaction[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.admin.ledger(),
    queryFn: getLedgerEntries,
    ...options,
  });
}

/**
 * Health summary polled every 2s while the page is mounted. The 2s cadence
 * matches the previous manual setInterval; React Query handles cleanup
 * automatically and pauses when the tab is hidden.
 */
export function useAdminHealth(
  options?: Omit<UseQueryOptions<HealthSummary>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.admin.health(),
    queryFn: getAdminHealth,
    refetchInterval: 2_000,
    refetchIntervalInBackground: false,
    ...options,
  });
}

// =============================================================================
// DATA PACKAGES (Marketplace pivot)
// =============================================================================

interface PackageListResult {
  data: DataPackage[];
  meta: { total: number; page: number; limit: number };
}

export function usePackages(
  filters?: PackageListFilters,
  options?: Omit<UseQueryOptions<PackageListResult>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: queryKeys.packages.list(filters as Record<string, unknown> | undefined),
    queryFn: () => listPackages(filters) as Promise<PackageListResult>,
    ...options,
  });
}

export function useMyPackages(
  options?: Omit<UseQueryOptions<DataPackage[]>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: queryKeys.packages.mine(),
    queryFn: listMyPackages,
    ...options,
  });
}

/**
 * Polled detail view. While a package is in `evaluating`, React Query refetches
 * every 2 s so the page flips to `certified` / `rejected` without user action.
 */
export function usePackage(
  id: string,
  options?: Omit<UseQueryOptions<DataPackage>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: queryKeys.packages.detail(id),
    queryFn: () => getPackage(id),
    enabled: !!id,
    refetchInterval: (query) => {
      const pkg = query.state.data as DataPackage | undefined;
      return pkg && (pkg.status === 'evaluating' || pkg.status === 'pending')
        ? 2_000
        : false;
    },
    refetchIntervalInBackground: false,
    ...options,
  });
}

export function useMyPurchases(
  options?: Omit<UseQueryOptions<PackagePurchaseWithPackage[]>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: queryKeys.purchases.mine(),
    queryFn: listMyPurchases,
    ...options,
  });
}

export function useAdminAllPackages(
  options?: Omit<UseQueryOptions<DataPackage[]>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: queryKeys.packages.adminAll(),
    queryFn: listAllPackagesAdmin,
    ...options,
  });
}

export function useCreatePackage() {
  const qc = useQueryClient();
  return useMutation<CreatePackageResponse, Error, CreatePackageInput>({
    mutationFn: (input) => createPackage(input),
    onSuccess: () => {
      // New row affects my-packages, marketplace listings, and admin all.
      qc.invalidateQueries({ queryKey: queryKeys.packages.all });
    },
  });
}

export function usePurchasePackage() {
  const qc = useQueryClient();
  return useMutation<PurchaseResponse, Error, string>({
    mutationFn: (packageId) => purchasePackage(packageId),
    onSuccess: (_data, packageId) => {
      // Buyer's wallet drained; seller's wallet credited. Touch:
      // - the purchased package row (status flips to 'sold' after first sale)
      // - my purchases list
      // - both wallet caches (buyer ledger + earnings reflect immediately)
      qc.invalidateQueries({ queryKey: queryKeys.packages.detail(packageId) });
      qc.invalidateQueries({ queryKey: queryKeys.packages.all });
      qc.invalidateQueries({ queryKey: queryKeys.purchases.all });
      qc.invalidateQueries({ queryKey: queryKeys.earnings.all });
      qc.invalidateQueries({ queryKey: queryKeys.ledger.all });
      qc.invalidateQueries({ queryKey: queryKeys.wallets.all });
    },
  });
}

export function useReevaluatePackage() {
  const qc = useQueryClient();
  return useMutation<CreatePackageResponse, Error, string>({
    mutationFn: (id) => reevaluatePackage(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.packages.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.packages.all });
    },
  });
}

export function useDelistPackage() {
  const qc = useQueryClient();
  return useMutation<CreatePackageResponse, Error, string>({
    mutationFn: (id) => delistPackage(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.packages.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.packages.all });
    },
  });
}

// =============================================================================
// EXTRACTOR
// =============================================================================

export function useEligibleApplications() {
  return useQuery({
    queryKey: queryKeys.extractor.eligibleApps(),
    queryFn:  listEligibleApplications,
  });
}

export function useExtractPreview() {
  return useMutation({
    mutationFn: ({ appId, from, to }: { appId: string; from?: string; to?: string }) =>
      extractPackagePreview(appId, { from, to }),
  });
}
