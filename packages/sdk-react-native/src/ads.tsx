/**
 * DataClaus Ad Revenue Module
 *
 * Two-step impression flow (slot/seal). The previous "client tells the
 * server how much it earned" pattern was bypass-bait — anyone could fork
 * the SDK and post `revenue: 0`. The new flow:
 *
 *   1. Server issues a signed slot token bound to (appId, userId, adType,
 *      adUnitId, nonce). Ad-unit IDs never live in client config, so they
 *      cannot be skimmed from a decompiled SDK and pointed at a different
 *      AdMob account.
 *   2. SDK renders the ad using the platform ad SDK (AdMob etc.).
 *   3. SDK seals the impression by handing the slot token back. Server
 *      verifies the signature, rejects replays via a DB unique index on the
 *      nonce, and resolves the authoritative revenue server-side.
 *
 * Client-reported revenue is treated as a CROSS-CHECK signal only. Forging
 * it does nothing — the ledger uses the server's reconciled value.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { generateChallenge, produceAttestation } from './attestation';

// ============================================================
// Types
// ============================================================

export type AdType = 'banner' | 'interstitial' | 'rewarded' | 'native';

export type AdSize =
  | 'banner'
  | 'largeBanner'
  | 'mediumRectangle'
  | 'fullBanner'
  | 'leaderboard'
  | 'adaptive';

export interface AdConfig {
  /** DataClaus API URL */
  apiUrl: string;
  /** Application ID from DataClaus dashboard */
  applicationId: string;
  /** User ID from identity linking (the dataclausUserId, not the external one) */
  userId: string;
  /** Short-lived bearer token from identity linking */
  userToken: string;
  /** Optional session ID for analytics */
  sessionId?: string;
  /** Use platform test ad units (no real revenue) */
  testMode?: boolean;
  /** Enable verbose logging */
  debug?: boolean;
}

export interface AdSlot {
  slotToken: string;
  adUnitId: string;
  adType: AdType;
  expiresAt: string;
  /** UI display only — NOT used to credit the ledger */
  projectedRevenue: number;
}

export interface AdImpression {
  impressionId: string;
  adType: AdType;
  adUnitId: string;
  /** Server-reconciled value */
  revenue: number;
  currency: string;
  timestamp: string;
}

export interface SealOptions {
  /** Ad-network reported revenue (e.g. AdMob paid event). Cross-check only. */
  reportedRevenue?: number;
  /** For rewarded ads: did the user complete the full view? */
  completed?: boolean;
}

export interface AdReward {
  type: string;
  amount: number;
}

// ============================================================
// Ad Manager
// ============================================================

export class AdManager {
  private config: Required<AdConfig>;
  private isEnabled: boolean = true;

  constructor(config: AdConfig) {
    this.config = {
      ...config,
      sessionId: config.sessionId ?? '',
      testMode: config.testMode ?? __DEV__,
      debug: config.debug ?? false,
    };
  }

  private log(message: string, ...args: unknown[]) {
    if (this.config.debug) {
      console.log(`[DataClaus Ads] ${message}`, ...args);
    }
  }

  isAdsEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * STEP 1. Request a signed ad slot from the server.
   *
   * The returned `adUnitId` is what the host app passes to the platform ad
   * SDK (AdMob/Unity Ads/etc.). The `slotToken` is opaque — keep it,
   * present it back at seal time.
   */
  async requestSlot(
    adType: AdType,
    qualityScoreHint?: number,
  ): Promise<AdSlot> {
    const challenge = generateChallenge();
    const attestation = await produceAttestation(challenge);

    const body: Record<string, unknown> = {
      ad_type: adType,
      user_id: this.config.userId,
    };
    if (this.config.sessionId) body.session_id = this.config.sessionId;
    if (typeof qualityScoreHint === 'number') {
      body.quality_score_hint = qualityScoreHint;
    }
    if (attestation) body.attestation = attestation;

    const response = await fetch(
      `${this.config.apiUrl}/applications/${this.config.applicationId}/ads/slot`,
      {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      throw new Error(`Slot request failed: HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      slotToken: data.slot_token,
      adUnitId: data.ad_unit_id,
      adType: data.ad_type,
      expiresAt: data.expires_at,
      projectedRevenue: data.projected_revenue,
    };
  }

  /**
   * STEP 2. Seal an impression. Call this AFTER the platform ad SDK
   * confirms the ad rendered (banner) or completed (rewarded).
   */
  async sealImpression(
    slot: AdSlot,
    options?: SealOptions,
  ): Promise<AdImpression | null> {
    const body: Record<string, unknown> = { slot_token: slot.slotToken };
    if (typeof options?.reportedRevenue === 'number') {
      body.reported_revenue = options.reportedRevenue;
    }
    if (typeof options?.completed === 'boolean') {
      body.completed = options.completed;
    }

    try {
      const response = await fetch(
        `${this.config.apiUrl}/applications/${this.config.applicationId}/ads/seal`,
        {
          method: 'POST',
          headers: this.authHeaders(),
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        this.log(`Seal failed: HTTP ${response.status}`);
        return null;
      }

      const data = await response.json();
      return {
        impressionId: data.id,
        adType: slot.adType,
        adUnitId: slot.adUnitId,
        revenue: Number(data.gross_revenue ?? 0),
        currency: 'USD',
        timestamp: new Date(data.created_at ?? Date.now()).toISOString(),
      };
    } catch (err) {
      this.log('Seal error:', err);
      return null;
    }
  }

  /**
   * Convenience: run a full ad cycle. The caller supplies a `render`
   * function that drives the platform ad SDK and returns the (optional)
   * ad-network-reported revenue.
   */
  async runCycle(
    adType: AdType,
    render: (
      slot: AdSlot,
    ) => Promise<{ reportedRevenue?: number; completed?: boolean } | void>,
  ): Promise<AdImpression | null> {
    const slot = await this.requestSlot(adType);
    const result = (await render(slot)) ?? {};
    return this.sealImpression(slot, result);
  }

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.userToken}`,
      'Content-Type': 'application/json',
    };
  }
}

// ============================================================
// Ad Context
// ============================================================

interface AdContextValue {
  manager: AdManager | null;
  isInitialized: boolean;
  isEnabled: boolean;
}

const AdContext = React.createContext<AdContextValue>({
  manager: null,
  isInitialized: false,
  isEnabled: false,
});

export interface AdProviderProps {
  config: AdConfig;
  children: React.ReactNode;
}

export function AdProvider({ config, children }: AdProviderProps) {
  const managerRef = useRef<AdManager | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  if (!managerRef.current) {
    managerRef.current = new AdManager(config);
  }

  useEffect(() => {
    managerRef.current = new AdManager(config);
    setIsInitialized(true);
  }, [config.apiUrl, config.applicationId, config.userId, config.userToken]);

  return (
    <AdContext.Provider
      value={{
        manager: managerRef.current,
        isInitialized,
        isEnabled: managerRef.current?.isAdsEnabled() ?? false,
      }}
    >
      {children}
    </AdContext.Provider>
  );
}

export function useAds() {
  return React.useContext(AdContext);
}

// ============================================================
// Banner Ad Component
// ============================================================

const AD_SIZES: Record<AdSize, { width: number; height: number }> = {
  banner: { width: 320, height: 50 },
  largeBanner: { width: 320, height: 100 },
  mediumRectangle: { width: 300, height: 250 },
  fullBanner: { width: 468, height: 60 },
  leaderboard: { width: 728, height: 90 },
  adaptive: { width: Dimensions.get('window').width, height: 60 },
};

export interface BannerAdProps {
  size?: AdSize;
  onAdLoaded?: () => void;
  onAdError?: (error: string) => void;
  onPaidEvent?: (impression: AdImpression) => void;
  /**
   * Host-app hook that drives the platform ad SDK with the resolved
   * `adUnitId`. Returns the revenue the platform reports (e.g. AdMob
   * `onPaidEvent` value). If omitted, the SDK seals without a reported
   * revenue and the server uses its projection.
   */
  renderPlatformAd?: (slot: AdSlot) => Promise<{ reportedRevenue?: number }>;
  style?: object;
}

export function BannerAd({
  size = 'banner',
  onAdLoaded,
  onAdError,
  onPaidEvent,
  renderPlatformAd,
  style,
}: BannerAdProps) {
  const { manager, isInitialized, isEnabled } = useAds();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const adSize = AD_SIZES[size];

  useEffect(() => {
    if (!isInitialized || !manager) return;
    if (!isEnabled) {
      setError('Ads disabled');
      setIsLoading(false);
      onAdError?.('Ads disabled');
      return;
    }

    let cancelled = false;
    const cycle = async () => {
      try {
        const impression = await manager.runCycle('banner', async (slot) => {
          if (renderPlatformAd) {
            return await renderPlatformAd(slot);
          }
          // No platform integration provided: just simulate a render.
          await new Promise<void>((resolve) => setTimeout(() => resolve(), 400));
          return {};
        });
        if (cancelled) return;
        setIsLoading(false);
        onAdLoaded?.();
        if (impression) onPaidEvent?.(impression);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Banner load failed';
        setError(msg);
        setIsLoading(false);
        onAdError?.(msg);
      }
    };
    void cycle();

    return () => {
      cancelled = true;
    };
  }, [isInitialized, isEnabled, manager, renderPlatformAd]);

  if (error || !isEnabled) return null;

  return (
    <View
      style={[
        styles.container,
        { width: adSize.width, height: adSize.height },
        style,
      ]}
    >
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#6366f1" />
        </View>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Advertisement</Text>
          <Text style={styles.poweredBy}>Powered by DataClaus</Text>
        </View>
      )}
    </View>
  );
}

// ============================================================
// Interstitial Hook
// ============================================================

export interface UseInterstitialResult {
  isLoaded: boolean;
  isLoading: boolean;
  load: () => Promise<void>;
  show: () => Promise<boolean>;
  error: string | null;
}

export interface UseInterstitialOptions {
  onPaidEvent?: (impression: AdImpression) => void;
  /** Host-app integration — see BannerAdProps.renderPlatformAd */
  renderPlatformAd?: (slot: AdSlot) => Promise<{ reportedRevenue?: number }>;
}

export function useInterstitialAd(
  options?: UseInterstitialOptions,
): UseInterstitialResult {
  const { manager, isInitialized, isEnabled } = useAds();
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slotRef = useRef<AdSlot | null>(null);

  const load = useCallback(async () => {
    if (!isInitialized || !isEnabled || !manager) {
      setError('Ads not available');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const slot = await manager.requestSlot('interstitial');
      slotRef.current = slot;
      setIsLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, isEnabled, manager]);

  const show = useCallback(async (): Promise<boolean> => {
    const slot = slotRef.current;
    if (!slot || !manager) return false;
    try {
      let result: { reportedRevenue?: number } = {};
      if (options?.renderPlatformAd) {
        result = await options.renderPlatformAd(slot);
      }
      const impression = await manager.sealImpression(slot, result);
      slotRef.current = null;
      setIsLoaded(false);
      if (impression) options?.onPaidEvent?.(impression);
      return impression !== null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Show failed');
      return false;
    }
  }, [manager, options]);

  return { isLoaded, isLoading, load, show, error };
}

// ============================================================
// Rewarded Hook
// ============================================================

export interface UseRewardedResult extends UseInterstitialResult {
  reward: AdReward | null;
}

export interface UseRewardedOptions extends UseInterstitialOptions {
  onRewarded?: (reward: AdReward) => void;
  /** Reward shape your app gives users on a completed view */
  reward?: AdReward;
}

export function useRewardedAd(options?: UseRewardedOptions): UseRewardedResult {
  const { manager, isInitialized, isEnabled } = useAds();
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reward, setReward] = useState<AdReward | null>(null);
  const slotRef = useRef<AdSlot | null>(null);

  const load = useCallback(async () => {
    if (!isInitialized || !isEnabled || !manager) {
      setError('Ads not available');
      return;
    }
    setIsLoading(true);
    setError(null);
    setReward(null);
    try {
      slotRef.current = await manager.requestSlot('rewarded');
      setIsLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, isEnabled, manager]);

  const show = useCallback(async (): Promise<boolean> => {
    const slot = slotRef.current;
    if (!slot || !manager) return false;
    try {
      let renderResult: { reportedRevenue?: number; completed?: boolean } = {};
      if (options?.renderPlatformAd) {
        renderResult = await options.renderPlatformAd(slot);
      }
      const impression = await manager.sealImpression(slot, {
        ...renderResult,
        completed: renderResult.completed ?? true,
      });
      slotRef.current = null;
      setIsLoaded(false);
      if (impression) {
        options?.onPaidEvent?.(impression);
        const grantedReward = options?.reward ?? { type: 'coins', amount: 50 };
        setReward(grantedReward);
        options?.onRewarded?.(grantedReward);
      }
      return impression !== null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Show failed');
      return false;
    }
  }, [manager, options]);

  return { isLoaded, isLoading, load, show, error, reward };
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  poweredBy: {
    fontSize: 8,
    color: '#94a3b8',
    marginTop: 2,
  },
});

export default AdManager;
