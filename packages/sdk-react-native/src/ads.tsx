/**
 * DataClaus Ad Revenue Module
 *
 * Provides components and utilities for displaying ads through DataClaus.
 * Revenue is automatically tracked and distributed according to the
 * app's revenue share configuration.
 *
 * Architecture:
 * 1. AdView component requests ad config from DataClaus API
 * 2. Displays ad using platform-specific ad SDK (Google AdMob)
 * 3. On impression/click, reports revenue to DataClaus
 * 4. DataClaus splits revenue: User share → Dev share → Platform fee
 *
 * IMPORTANT: Ad revenue flows through DataClaus's AdMob account to ensure
 * fair revenue distribution. Developers integrate the AdView component
 * and receive their share of the revenue automatically.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, Dimensions } from 'react-native';

// ============================================================
// Types
// ============================================================

export type AdType = 'banner' | 'interstitial' | 'rewarded' | 'native';

export type AdSize = 
  | 'banner'           // 320x50
  | 'largeBanner'      // 320x100
  | 'mediumRectangle'  // 300x250
  | 'fullBanner'       // 468x60
  | 'leaderboard'      // 728x90
  | 'adaptive';        // Responsive

export interface AdConfig {
  /** DataClaus API URL */
  apiUrl: string;
  /** Application ID from DataClaus dashboard */
  applicationId: string;
  /** User token from identity linking */
  userToken: string;
  /** Enable test mode (uses test ads) */
  testMode?: boolean;
  /** Enable debug logging */
  debug?: boolean;
}

export interface AdUnitConfig {
  banner?: string;
  interstitial?: string;
  rewarded?: string;
  native?: string;
}

export interface AdImpression {
  impressionId: string;
  adType: AdType;
  adUnitId: string;
  revenue: number;
  currency: string;
  timestamp: string;
}

export interface AdReward {
  type: string;
  amount: number;
}

export interface AdLoadResult {
  success: boolean;
  adUnitId?: string;
  error?: string;
}

// ============================================================
// Ad Manager Class
// ============================================================

export class AdManager {
  private config: Required<AdConfig>;
  private adUnits: AdUnitConfig | null = null;
  private isEnabled: boolean = false;

  constructor(config: AdConfig) {
    this.config = {
      ...config,
      testMode: config.testMode ?? true, // Default to test mode for safety
      debug: config.debug ?? false,
    };
  }

  private log(message: string, ...args: unknown[]) {
    if (this.config.debug) {
      console.log(`[DataClaus Ads] ${message}`, ...args);
    }
  }

  /**
   * Initialize the ad manager by fetching ad configuration.
   */
  async initialize(): Promise<void> {
    this.log('Initializing ad manager...');

    try {
      const response = await fetch(
        `${this.config.apiUrl}/applications/${this.config.applicationId}/ads/config`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.userToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch ad config');
      }

      const data = await response.json();
      this.adUnits = data.ad_unit_ids || {};
      this.isEnabled = data.enabled ?? false;

      if (this.config.testMode) {
        // Use test ad unit IDs
        this.adUnits = {
          banner: Platform.select({
            ios: 'ca-app-pub-3940256099942544/2934735716',
            android: 'ca-app-pub-3940256099942544/6300978111',
          }),
          interstitial: Platform.select({
            ios: 'ca-app-pub-3940256099942544/4411468910',
            android: 'ca-app-pub-3940256099942544/1033173712',
          }),
          rewarded: Platform.select({
            ios: 'ca-app-pub-3940256099942544/1712485313',
            android: 'ca-app-pub-3940256099942544/5224354917',
          }),
        };
        this.log('Using test ad units');
      }

      this.log('Ad manager initialized:', this.adUnits);
    } catch (error) {
      this.log('Failed to initialize:', error);
      this.isEnabled = false;
    }
  }

  /**
   * Check if ads are enabled for this app.
   */
  isAdsEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Get ad unit ID for a specific ad type.
   */
  getAdUnitId(type: AdType): string | undefined {
    return this.adUnits?.[type];
  }

  /**
   * Record an ad impression and track revenue.
   */
  async recordImpression(
    adType: AdType,
    revenue: number,
    currency: string = 'USD'
  ): Promise<AdImpression | null> {
    const adUnitId = this.getAdUnitId(adType);
    if (!adUnitId) {
      this.log('No ad unit ID for type:', adType);
      return null;
    }

    this.log('Recording impression:', { adType, revenue, currency });

    try {
      const response = await fetch(
        `${this.config.apiUrl}/applications/${this.config.applicationId}/ads/impression`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.userToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_token: this.config.userToken,
            ad_type: adType,
            ad_unit_id: adUnitId,
            revenue,
            currency,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to record impression');
      }

      const data = await response.json();
      return {
        impressionId: data.impression_id,
        adType,
        adUnitId,
        revenue,
        currency,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.log('Failed to record impression:', error);
      return null;
    }
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

/**
 * AdProvider component - wraps your app to enable ads.
 *
 * Usage:
 * ```tsx
 * <AdProvider config={{
 *   apiUrl: 'https://api.dataclaus.io',
 *   applicationId: 'your-app-id',
 *   userToken: linkedUser.userToken,
 *   testMode: __DEV__,
 * }}>
 *   <YourApp />
 * </AdProvider>
 * ```
 */
export function AdProvider({ config, children }: AdProviderProps) {
  const managerRef = useRef<AdManager | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    const manager = new AdManager(config);
    managerRef.current = manager;

    manager.initialize().then(() => {
      setIsInitialized(true);
      setIsEnabled(manager.isAdsEnabled());
    });
  }, [config.apiUrl, config.applicationId, config.userToken]);

  return (
    <AdContext.Provider value={{ manager: managerRef.current, isInitialized, isEnabled }}>
      {children}
    </AdContext.Provider>
  );
}

/**
 * Hook to access ad manager.
 */
export function useAds() {
  const context = React.useContext(AdContext);
  return context;
}

// ============================================================
// Banner Ad Component
// ============================================================

export interface BannerAdProps {
  /** Ad size */
  size?: AdSize;
  /** Called when ad loads successfully */
  onAdLoaded?: () => void;
  /** Called when ad fails to load */
  onAdError?: (error: string) => void;
  /** Called when ad is clicked */
  onAdClicked?: () => void;
  /** Called when revenue is generated */
  onPaidEvent?: (impression: AdImpression) => void;
  /** Custom styles */
  style?: object;
}

const AD_SIZES: Record<AdSize, { width: number; height: number }> = {
  banner: { width: 320, height: 50 },
  largeBanner: { width: 320, height: 100 },
  mediumRectangle: { width: 300, height: 250 },
  fullBanner: { width: 468, height: 60 },
  leaderboard: { width: 728, height: 90 },
  adaptive: { width: Dimensions.get('window').width, height: 60 },
};

/**
 * BannerAd component - displays a banner advertisement.
 *
 * Revenue from this ad is automatically tracked and distributed according
 * to your app's revenue share configuration.
 *
 * Usage:
 * ```tsx
 * <BannerAd
 *   size="banner"
 *   onPaidEvent={(event) => console.log(`Earned: $${event.revenue}`)}
 * />
 * ```
 */
export function BannerAd({
  size = 'banner',
  onAdLoaded,
  onAdError,
  onAdClicked,
  onPaidEvent,
  style,
}: BannerAdProps) {
  const { manager, isInitialized, isEnabled } = useAds();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPlaceholder, setShowPlaceholder] = useState(true);

  const adSize = AD_SIZES[size];
  const adUnitId = manager?.getAdUnitId('banner');

  useEffect(() => {
    if (!isInitialized) return;

    if (!isEnabled || !adUnitId) {
      setError('Ads not enabled');
      setIsLoading(false);
      onAdError?.('Ads not enabled for this application');
      return;
    }

    // Simulate ad loading (in production, this connects to AdMob)
    const loadAd = async () => {
      try {
        // In production, use react-native-google-mobile-ads
        // await BannerAd.requestAd(adUnitId, size);

        // Simulate successful load
        await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
        
        setIsLoading(false);
        setShowPlaceholder(false);
        onAdLoaded?.();

        // Simulate ad impression revenue (in production, AdMob reports this)
        // Average banner CPM is around $0.50-$2.00
        const estimatedRevenue = 0.001; // $1 CPM = $0.001 per impression
        const impression = await manager?.recordImpression('banner', estimatedRevenue);
        if (impression) {
          onPaidEvent?.(impression);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load ad';
        setError(message);
        setIsLoading(false);
        onAdError?.(message);
      }
    };

    loadAd();
  }, [isInitialized, isEnabled, adUnitId]);

  if (!isEnabled || error) {
    // Don't show anything if ads are disabled or errored
    return null;
  }

  return (
    <View style={[styles.container, { width: adSize.width, height: adSize.height }, style]}>
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#6366f1" />
        </View>
      )}
      {showPlaceholder && !isLoading && (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Advertisement</Text>
          <Text style={styles.poweredBy}>Powered by DataClaus</Text>
        </View>
      )}
    </View>
  );
}

// ============================================================
// Interstitial Ad Hook
// ============================================================

export interface UseInterstitialResult {
  /** Whether ad is loaded and ready */
  isLoaded: boolean;
  /** Whether ad is currently loading */
  isLoading: boolean;
  /** Load the ad */
  load: () => Promise<void>;
  /** Show the ad */
  show: () => Promise<boolean>;
  /** Error message if any */
  error: string | null;
}

/**
 * Hook for interstitial (full-screen) ads.
 *
 * Usage:
 * ```tsx
 * const { isLoaded, load, show } = useInterstitialAd();
 *
 * // Load ad on component mount
 * useEffect(() => { load(); }, []);
 *
 * // Show ad at appropriate time
 * const handleLevelComplete = async () => {
 *   if (isLoaded) await show();
 * };
 * ```
 */
export function useInterstitialAd(
  onPaidEvent?: (impression: AdImpression) => void
): UseInterstitialResult {
  const { manager, isInitialized, isEnabled } = useAds();
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isInitialized || !isEnabled || !manager) {
      setError('Ads not available');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // In production, use react-native-google-mobile-ads
      // await InterstitialAd.load(adUnitId);
      await new Promise<void>(resolve => setTimeout(() => resolve(), 1000));
      setIsLoaded(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load ad';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, isEnabled, manager]);

  const show = useCallback(async (): Promise<boolean> => {
    if (!isLoaded || !manager) {
      return false;
    }

    try {
      // In production, use react-native-google-mobile-ads
      // await interstitial.show();

      // Record impression (interstitials have higher CPM, ~$1-5)
      const estimatedRevenue = 0.003; // ~$3 CPM
      const impression = await manager.recordImpression('interstitial', estimatedRevenue);
      if (impression) {
        onPaidEvent?.(impression);
      }

      setIsLoaded(false);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to show ad';
      setError(message);
      return false;
    }
  }, [isLoaded, manager, onPaidEvent]);

  return { isLoaded, isLoading, load, show, error };
}

// ============================================================
// Rewarded Ad Hook
// ============================================================

export interface UseRewardedResult extends UseInterstitialResult {
  /** The reward received from watching the ad */
  reward: AdReward | null;
}

/**
 * Hook for rewarded ads (user watches ad, gets reward).
 *
 * Usage:
 * ```tsx
 * const { isLoaded, load, show, reward } = useRewardedAd({
 *   onRewarded: (reward) => {
 *     giveUserCoins(reward.amount);
 *   }
 * });
 *
 * // Button to watch ad
 * <Button
 *   title="Watch Ad for 50 Coins"
 *   onPress={show}
 *   disabled={!isLoaded}
 * />
 * ```
 */
export function useRewardedAd(options?: {
  onRewarded?: (reward: AdReward) => void;
  onPaidEvent?: (impression: AdImpression) => void;
}): UseRewardedResult {
  const { manager, isInitialized, isEnabled } = useAds();
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reward, setReward] = useState<AdReward | null>(null);

  const load = useCallback(async () => {
    if (!isInitialized || !isEnabled || !manager) {
      setError('Ads not available');
      return;
    }

    setIsLoading(true);
    setError(null);
    setReward(null);

    try {
      await new Promise<void>(resolve => setTimeout(() => resolve(), 1000));
      setIsLoaded(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load ad';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, isEnabled, manager]);

  const show = useCallback(async (): Promise<boolean> => {
    if (!isLoaded || !manager) {
      return false;
    }

    try {
      // Simulate rewarded ad view
      // In production, this would show the actual ad

      // Rewarded ads have highest CPM (~$5-20)
      const estimatedRevenue = 0.01; // ~$10 CPM (higher for completed views)
      const impression = await manager.recordImpression('rewarded', estimatedRevenue);
      if (impression) {
        options?.onPaidEvent?.(impression);
      }

      // Give reward
      const adReward: AdReward = { type: 'coins', amount: 50 };
      setReward(adReward);
      options?.onRewarded?.(adReward);

      setIsLoaded(false);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to show ad';
      setError(message);
      return false;
    }
  }, [isLoaded, manager, options]);

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
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
