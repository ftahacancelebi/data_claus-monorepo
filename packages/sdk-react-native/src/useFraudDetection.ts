/**
 * React Native Hook for Fraud Detection
 * ======================================
 *
 * Complete integration hook that handles:
 * - Sensor collection (accelerometer, gyroscope)
 * - Battery monitoring
 * - Pedometer tracking
 * - Scroll event capture
 * - Adaptive sampling based on activity
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as Battery from 'expo-battery';
import {
  FraudDetectionCollector,
  FraudMetrics,
  ActivityState,
  AdaptiveWindowConfig,
  DEFAULT_CONFIG,
} from './fraud-detection';

// ============================================
// TYPES
// ============================================

export interface FraudDetectionHookConfig
  extends Partial<AdaptiveWindowConfig> {
  /** Enable debug logging */
  debug?: boolean;
  /** Auto-start collection on mount */
  autoStart?: boolean;
  /** Minimum collection time before allowing analyze (ms) */
  minCollectionTime?: number;
}

export interface FraudDetectionState {
  isCollecting: boolean;
  activityState: ActivityState;
  sampleRate: number;
  progress: number;
  samplesCollected: number;
  collectionDuration: number;
}

export interface FraudDetectionHookResult {
  // State
  state: FraudDetectionState;
  metrics: FraudMetrics | null;

  // Controls
  start: () => void;
  stop: () => Promise<FraudMetrics>;
  analyze: () => Promise<FraudMetrics>;
  reset: () => void;

  // Sensor handlers (for manual integration)
  onAccelerometer: (data: { x: number; y: number; z: number }) => void;
  onGyroscope: (data: { x: number; y: number; z: number }) => void;
  onScroll: (deltaY: number, velocity: number) => void;
  onTouch: (duration: number, pressure: number, x: number, y: number) => void;

  // Status
  hasEnoughData: boolean;
  canAnalyze: boolean;
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useFraudDetection(
  sensors: {
    Accelerometer?: {
      addListener: (
        callback: (data: { x: number; y: number; z: number }) => void
      ) => { remove: () => void };
      setUpdateInterval: (interval: number) => void;
    };
    Gyroscope?: {
      addListener: (
        callback: (data: { x: number; y: number; z: number }) => void
      ) => { remove: () => void };
      setUpdateInterval: (interval: number) => void;
    };
    Pedometer?: {
      getStepCountAsync: (start: Date, end: Date) => Promise<{ steps: number }>;
      isAvailableAsync: () => Promise<boolean>;
    };
  },
  config: FraudDetectionHookConfig = {}
): FraudDetectionHookResult {
  const {
    debug = false,
    autoStart = false,
    minCollectionTime = 3000,
    ...adaptiveConfig
  } = config;

  // Refs
  const collectorRef = useRef<FraudDetectionCollector | null>(null);
  const startTimeRef = useRef<number>(0);
  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const batterySubscriptionRef = useRef<{ remove: () => void } | null>(null);
  const pedometerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sensorSubscriptionsRef = useRef<Array<{ remove: () => void }>>([]);

  // State
  const [state, setState] = useState<FraudDetectionState>({
    isCollecting: false,
    activityState: 'unknown',
    sampleRate: DEFAULT_CONFIG.baseSampleRate,
    progress: 0,
    samplesCollected: 0,
    collectionDuration: 0,
  });
  const [metrics, setMetrics] = useState<FraudMetrics | null>(null);

  // Initialize collector
  useEffect(() => {
    collectorRef.current = new FraudDetectionCollector(adaptiveConfig);

    if (debug) {
      console.log(
        '[useFraudDetection] Initialized with config:',
        adaptiveConfig
      );
    }

    return () => {
      cleanup();
    };
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
    if (batterySubscriptionRef.current) {
      batterySubscriptionRef.current.remove();
      batterySubscriptionRef.current = null;
    }
    if (pedometerIntervalRef.current) {
      clearInterval(pedometerIntervalRef.current);
      pedometerIntervalRef.current = null;
    }
    sensorSubscriptionsRef.current.forEach((sub: { remove: () => void }) =>
      sub.remove()
    );
    sensorSubscriptionsRef.current = [];
  }, []);

  // Update state periodically
  const startStateUpdates = useCallback(() => {
    updateIntervalRef.current = setInterval(() => {
      if (!collectorRef.current) return;

      const data = collectorRef.current.exportData() as {
        accelerometer: number;
      };

      setState((prev: FraudDetectionState) => ({
        ...prev,
        activityState: collectorRef.current?.getActivityState() || 'unknown',
        sampleRate:
          collectorRef.current?.getCurrentSampleRate() ||
          DEFAULT_CONFIG.baseSampleRate,
        progress: collectorRef.current?.getCollectionProgress() || 0,
        samplesCollected: data.accelerometer || 0,
        collectionDuration: Date.now() - startTimeRef.current,
      }));
    }, 500);
  }, []);

  // Setup battery monitoring
  const setupBatteryMonitoring = useCallback(async () => {
    try {
      // Get initial state
      const level = await Battery.getBatteryLevelAsync();
      const batteryState = await Battery.getBatteryStateAsync();
      const isCharging = batteryState === Battery.BatteryState.CHARGING;

      collectorRef.current?.trackBattery(level * 100, isCharging);

      // Subscribe to changes
      batterySubscriptionRef.current = Battery.addBatteryStateListener(
        (stateEvent: Battery.BatteryStateEvent) => {
          Battery.getBatteryLevelAsync().then((batteryLevel: number) => {
            collectorRef.current?.trackBattery(
              batteryLevel * 100,
              stateEvent.batteryState === Battery.BatteryState.CHARGING
            );
          });
        }
      );
    } catch (e) {
      if (debug) {
        console.log('[useFraudDetection] Battery API not available:', e);
      }
    }
  }, [debug]);

  // Setup pedometer monitoring
  const setupPedometerMonitoring = useCallback(async () => {
    if (!sensors.Pedometer) return;

    try {
      const isAvailable = await sensors.Pedometer.isAvailableAsync();
      if (!isAvailable) return;

      const startDate = new Date();

      const pedometer = sensors.Pedometer;
      pedometerIntervalRef.current = setInterval(async () => {
        try {
          const result = await pedometer.getStepCountAsync(
            startDate,
            new Date()
          );
          collectorRef.current?.trackPedometer(result.steps);
        } catch {
          // Ignore pedometer errors
        }
      }, 1000);
    } catch (e) {
      if (debug) {
        console.log('[useFraudDetection] Pedometer not available:', e);
      }
    }
  }, [sensors.Pedometer, debug]);

  // Setup sensor subscriptions
  const setupSensors = useCallback(() => {
    const subscriptions: Array<{ remove: () => void }> = [];

    // Accelerometer
    if (sensors.Accelerometer) {
      const interval =
        1000 / (collectorRef.current?.getCurrentSampleRate() || 50);
      sensors.Accelerometer.setUpdateInterval(interval);

      const sub = sensors.Accelerometer.addListener((data) => {
        collectorRef.current?.trackAccelerometer(data);
      });
      subscriptions.push(sub);
    }

    // Gyroscope
    if (sensors.Gyroscope) {
      const interval =
        1000 / (collectorRef.current?.getCurrentSampleRate() || 50);
      sensors.Gyroscope.setUpdateInterval(interval);

      const sub = sensors.Gyroscope.addListener((data) => {
        collectorRef.current?.trackGyroscope(data);
      });
      subscriptions.push(sub);
    }

    sensorSubscriptionsRef.current = subscriptions;
  }, [sensors.Accelerometer, sensors.Gyroscope]);

  // Start collection
  const start = useCallback(() => {
    if (state.isCollecting) return;

    if (debug) {
      console.log('[useFraudDetection] Starting collection');
    }

    startTimeRef.current = Date.now();
    collectorRef.current?.start();

    setState((prev: FraudDetectionState) => ({ ...prev, isCollecting: true }));

    setupSensors();
    setupBatteryMonitoring();
    setupPedometerMonitoring();
    startStateUpdates();
  }, [
    state.isCollecting,
    debug,
    setupSensors,
    setupBatteryMonitoring,
    setupPedometerMonitoring,
    startStateUpdates,
  ]);

  // Stop collection and analyze
  const stop = useCallback(async (): Promise<FraudMetrics> => {
    if (debug) {
      console.log('[useFraudDetection] Stopping collection');
    }

    cleanup();

    const result = await collectorRef.current?.stop();

    setState((prev: FraudDetectionState) => ({ ...prev, isCollecting: false }));

    if (result) {
      setMetrics(result);
      return result;
    }

    throw new Error('No collector available');
  }, [debug, cleanup]);

  // Analyze without stopping (peek at current state)
  const analyze = useCallback(async (): Promise<FraudMetrics> => {
    if (!collectorRef.current) {
      throw new Error('Collector not initialized');
    }

    const result = await collectorRef.current.analyze();
    setMetrics(result);
    return result;
  }, []);

  // Reset for new session
  const reset = useCallback(() => {
    cleanup();
    collectorRef.current = new FraudDetectionCollector(adaptiveConfig);
    setMetrics(null);
    setState({
      isCollecting: false,
      activityState: 'unknown',
      sampleRate: DEFAULT_CONFIG.baseSampleRate,
      progress: 0,
      samplesCollected: 0,
      collectionDuration: 0,
    });
  }, [cleanup, adaptiveConfig]);

  // Manual sensor handlers
  const onAccelerometer = useCallback(
    (data: { x: number; y: number; z: number }) => {
      collectorRef.current?.trackAccelerometer(data);
    },
    []
  );

  const onGyroscope = useCallback(
    (data: { x: number; y: number; z: number }) => {
      collectorRef.current?.trackGyroscope(data);
    },
    []
  );

  const onScroll = useCallback((deltaY: number, velocity: number) => {
    collectorRef.current?.trackScroll(deltaY, velocity);
  }, []);

  const onTouch = useCallback(
    (duration: number, pressure: number, x: number, y: number) => {
      collectorRef.current?.trackTouch(duration, pressure, x, y);
    },
    []
  );

  // Auto-start if configured
  useEffect(() => {
    if (autoStart) {
      start();
    }
  }, [autoStart]);

  // Derived state
  const hasEnoughData = collectorRef.current?.hasEnoughData() || false;
  const canAnalyze =
    hasEnoughData && state.collectionDuration >= minCollectionTime;

  return {
    state,
    metrics,
    start,
    stop,
    analyze,
    reset,
    onAccelerometer,
    onGyroscope,
    onScroll,
    onTouch,
    hasEnoughData,
    canAnalyze,
  };
}

export default useFraudDetection;
