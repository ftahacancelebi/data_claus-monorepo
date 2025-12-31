/**
 * DataClausProvider - Context Wrapper Component
 * 
 * Foundation component that initializes the SDK, manages session lifecycle,
 * and provides context to all child components.
 * 
 * @example
 * ```tsx
 * <DataClausProvider
 *   config={{
 *     backendUrl: 'https://your-backend.com',
 *     userId: 'user123',
 *   }}
 *   onReady={() => console.log('DataClaus initialized')}
 * >
 *   <App />
 * </DataClausProvider>
 * ```
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { DataClausCollector, DataClausConfig, SessionInfo } from '../index';

// Types
export interface QualityScore {
  score: number; // 0-100
  level: 'excellent' | 'good' | 'fair' | 'poor' | 'suspicious';
  factors: {
    sensorVariance: number;
    touchPatterns: number;
    sessionDuration: number;
    deviceAuthenticity: number;
  };
  lastUpdated: string;
}

export interface Earnings {
  today: number;
  thisWeek: number;
  thisMonth: number;
  total: number;
  pendingPayout: number;
  currency: string;
}

export interface DataClausContextValue {
  // Core
  collector: DataClausCollector | null;
  isInitialized: boolean;
  isCollecting: boolean;
  sessionInfo: SessionInfo | null;
  
  // Quality & Earnings
  qualityScore: QualityScore | null;
  earnings: Earnings | null;
  
  // Actions
  startCollection: () => void;
  stopCollection: () => void;
  trackEvent: (eventType: string, payload: Record<string, unknown>) => void;
  trackScreenView: (screenName: string) => void;
  refreshQualityScore: () => Promise<void>;
  refreshEarnings: () => Promise<void>;
  
  // Consent
  hasConsent: boolean;
  grantConsent: () => Promise<void>;
  revokeConsent: () => Promise<void>;
  
  // Config
  config: DataClausConfig;
}

export interface DataClausProviderProps {
  children: ReactNode;
  config: DataClausConfig;
  onReady?: () => void;
  onError?: (error: Error) => void;
  onQualityScoreUpdate?: (score: QualityScore) => void;
  onEarningsUpdate?: (earnings: Earnings) => void;
  autoStart?: boolean;
  fetchQualityInterval?: number; // ms, default 30000
  fetchEarningsInterval?: number; // ms, default 60000
}

// Default quality score
const DEFAULT_QUALITY_SCORE: QualityScore = {
  score: 0,
  level: 'poor',
  factors: {
    sensorVariance: 0,
    touchPatterns: 0,
    sessionDuration: 0,
    deviceAuthenticity: 0,
  },
  lastUpdated: new Date().toISOString(),
};

// Default earnings
const DEFAULT_EARNINGS: Earnings = {
  today: 0,
  thisWeek: 0,
  thisMonth: 0,
  total: 0,
  pendingPayout: 0,
  currency: 'USD',
};

// Context
const DataClausContext = createContext<DataClausContextValue | null>(null);

// Helper to determine quality level
const getQualityLevel = (score: number): QualityScore['level'] => {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  if (score >= 30) return 'poor';
  return 'suspicious';
};

/**
 * DataClausProvider Component
 */
export function DataClausProvider({
  children,
  config,
  onReady,
  onError,
  onQualityScoreUpdate,
  onEarningsUpdate,
  autoStart = true,
  fetchQualityInterval = 30000,
  fetchEarningsInterval = 60000,
}: DataClausProviderProps) {
  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [qualityScore, setQualityScore] = useState<QualityScore>(DEFAULT_QUALITY_SCORE);
  const [earnings, setEarnings] = useState<Earnings>(DEFAULT_EARNINGS);
  const [hasConsent, setHasConsent] = useState(false);
  
  // Refs
  const collectorRef = useRef<DataClausCollector | null>(null);
  const qualityIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const earningsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  
  // Initialize collector
  useEffect(() => {
    try {
      collectorRef.current = new DataClausCollector(config);
      setIsInitialized(true);
      setSessionInfo(collectorRef.current.getSessionInfo());
      
      // Check stored consent
      checkStoredConsent();
      
      onReady?.();
      
      if (config.debug) {
        console.log('[DataClausProvider] Initialized with config:', config);
      }
    } catch (error) {
      onError?.(error as Error);
    }
    
    return () => {
      collectorRef.current?.stop();
      clearAllIntervals();
    };
  }, [config.backendUrl, config.userId]);
  
  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isCollecting]);
  
  // Auto-start collection
  useEffect(() => {
    if (isInitialized && autoStart && hasConsent) {
      startCollection();
    }
  }, [isInitialized, autoStart, hasConsent]);
  
  // Periodic quality/earnings fetch
  useEffect(() => {
    if (isCollecting && hasConsent) {
      startPeriodicFetches();
    } else {
      clearAllIntervals();
    }
    
    return () => clearAllIntervals();
  }, [isCollecting, hasConsent]);
  
  // Handle app state changes (pause when background)
  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    if (appStateRef.current.match(/active/) && nextAppState.match(/inactive|background/)) {
      // App going to background
      if (isCollecting) {
        collectorRef.current?.flush();
      }
    } else if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
      // App coming to foreground
      setSessionInfo(collectorRef.current?.getSessionInfo() || null);
    }
    appStateRef.current = nextAppState;
  }, [isCollecting]);
  
  // Check stored consent (simplified - in production use AsyncStorage)
  const checkStoredConsent = useCallback(async () => {
    // In production, check AsyncStorage for stored consent
    // For now, assume no consent by default
    setHasConsent(false);
  }, []);
  
  // Start periodic fetches
  const startPeriodicFetches = useCallback(() => {
    // Quality score fetch
    refreshQualityScore();
    qualityIntervalRef.current = setInterval(refreshQualityScore, fetchQualityInterval);
    
    // Earnings fetch
    refreshEarnings();
    earningsIntervalRef.current = setInterval(refreshEarnings, fetchEarningsInterval);
  }, [fetchQualityInterval, fetchEarningsInterval]);
  
  // Clear all intervals
  const clearAllIntervals = useCallback(() => {
    if (qualityIntervalRef.current) {
      clearInterval(qualityIntervalRef.current);
      qualityIntervalRef.current = null;
    }
    if (earningsIntervalRef.current) {
      clearInterval(earningsIntervalRef.current);
      earningsIntervalRef.current = null;
    }
  }, []);
  
  // Actions
  const startCollection = useCallback(() => {
    if (!hasConsent) {
      console.warn('[DataClausProvider] Cannot start collection without consent');
      return;
    }
    collectorRef.current?.start();
    setIsCollecting(true);
    setSessionInfo(collectorRef.current?.getSessionInfo() || null);
  }, [hasConsent]);
  
  const stopCollection = useCallback(() => {
    collectorRef.current?.stop();
    setIsCollecting(false);
  }, []);
  
  const trackEvent = useCallback((eventType: string, payload: Record<string, unknown>) => {
    collectorRef.current?.trackCustom(eventType, payload);
  }, []);
  
  const trackScreenView = useCallback((screenName: string) => {
    collectorRef.current?.trackScreenView(screenName);
  }, []);
  
  // Fetch quality score from backend
  const refreshQualityScore = useCallback(async () => {
    if (!config.backendUrl || !config.userId) return;
    
    try {
      const response = await fetch(
        `${config.backendUrl}/dataclaus/quality-score?userId=${config.userId}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        const newScore: QualityScore = {
          score: data.score || 0,
          level: getQualityLevel(data.score || 0),
          factors: {
            sensorVariance: data.factors?.sensorVariance || 0,
            touchPatterns: data.factors?.touchPatterns || 0,
            sessionDuration: data.factors?.sessionDuration || 0,
            deviceAuthenticity: data.factors?.deviceAuthenticity || 0,
          },
          lastUpdated: new Date().toISOString(),
        };
        setQualityScore(newScore);
        onQualityScoreUpdate?.(newScore);
      }
    } catch (error) {
      if (config.debug) {
        console.log('[DataClausProvider] Failed to fetch quality score:', error);
      }
    }
  }, [config.backendUrl, config.userId, config.debug, onQualityScoreUpdate]);
  
  // Fetch earnings from backend
  const refreshEarnings = useCallback(async () => {
    if (!config.backendUrl || !config.userId) return;
    
    try {
      const response = await fetch(
        `${config.backendUrl}/dataclaus/earnings?userId=${config.userId}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        const newEarnings: Earnings = {
          today: data.today || 0,
          thisWeek: data.thisWeek || 0,
          thisMonth: data.thisMonth || 0,
          total: data.total || 0,
          pendingPayout: data.pendingPayout || 0,
          currency: data.currency || 'USD',
        };
        setEarnings(newEarnings);
        onEarningsUpdate?.(newEarnings);
      }
    } catch (error) {
      if (config.debug) {
        console.log('[DataClausProvider] Failed to fetch earnings:', error);
      }
    }
  }, [config.backendUrl, config.userId, config.debug, onEarningsUpdate]);
  
  // Consent management
  const grantConsent = useCallback(async () => {
    try {
      // In production, store in AsyncStorage and notify backend
      await fetch(`${config.backendUrl}/dataclaus/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: config.userId,
          consentGranted: true,
          timestamp: new Date().toISOString(),
          consentType: 'data_collection',
        }),
      });
      
      setHasConsent(true);
      
      // Track consent event
      trackEvent('consent_granted', { timestamp: new Date().toISOString() });
      
      if (config.debug) {
        console.log('[DataClausProvider] Consent granted');
      }
    } catch (error) {
      if (config.debug) {
        console.error('[DataClausProvider] Failed to grant consent:', error);
      }
      // Still set consent locally even if network fails
      setHasConsent(true);
    }
  }, [config.backendUrl, config.userId, config.debug, trackEvent]);
  
  const revokeConsent = useCallback(async () => {
    try {
      await fetch(`${config.backendUrl}/dataclaus/consent`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: config.userId,
          timestamp: new Date().toISOString(),
        }),
      });
      
      // Stop collection immediately
      stopCollection();
      setHasConsent(false);
      
      if (config.debug) {
        console.log('[DataClausProvider] Consent revoked');
      }
    } catch (error) {
      if (config.debug) {
        console.error('[DataClausProvider] Failed to revoke consent:', error);
      }
      stopCollection();
      setHasConsent(false);
    }
  }, [config.backendUrl, config.userId, config.debug, stopCollection]);
  
  // Context value
  const contextValue: DataClausContextValue = {
    // Core
    collector: collectorRef.current,
    isInitialized,
    isCollecting,
    sessionInfo,
    
    // Quality & Earnings
    qualityScore,
    earnings,
    
    // Actions
    startCollection,
    stopCollection,
    trackEvent,
    trackScreenView,
    refreshQualityScore,
    refreshEarnings,
    
    // Consent
    hasConsent,
    grantConsent,
    revokeConsent,
    
    // Config
    config,
  };
  
  return (
    <DataClausContext.Provider value={contextValue}>
      {children}
    </DataClausContext.Provider>
  );
}

/**
 * Hook to access DataClaus context
 */
export function useDataClausContext(): DataClausContextValue {
  const context = useContext(DataClausContext);
  if (!context) {
    throw new Error('useDataClausContext must be used within a DataClausProvider');
  }
  return context;
}

/**
 * HOC to inject DataClaus props
 */
export function withDataClaus<P extends object>(
  WrappedComponent: React.ComponentType<P & { dataClaus: DataClausContextValue }>
) {
  return function WithDataClausComponent(props: P) {
    const dataClaus = useDataClausContext();
    return <WrappedComponent {...props} dataClaus={dataClaus} />;
  };
}

export default DataClausProvider;
