/**
 * DataClaus React Native SDK
 *
 * Collects sensor data (accelerometer, gyroscope) and behavioral patterns
 * from mobile devices and sends them to the developer's backend.
 *
 * Flow: Mobile App (this SDK) -> Developer's Node.js Backend -> DataClaus API
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform, Dimensions } from 'react-native';

// Types
export interface DataClausConfig {
  /** Developer's backend URL where data will be sent */
  backendUrl: string;
  /** User ID in your system */
  userId: string;
  /** Optional session ID (auto-generated if not provided) */
  sessionId?: string;
  /** Data collection interval in milliseconds (default: 100ms) */
  collectionInterval?: number;
  /** Batch size before sending (default: 50 events) */
  batchSize?: number;
  /** Flush interval in milliseconds (default: 5000ms) */
  flushInterval?: number;
  /** Enable debug logging */
  debug?: boolean;
}

export interface SensorData {
  accelerometer?: { x: number; y: number; z: number };
  gyroscope?: { x: number; y: number; z: number };
}

export interface TouchData {
  pressure?: number;
  locationX: number;
  locationY: number;
  timestamp: number;
}

export interface SessionInfo {
  sessionId: string;
  startTime: string;
  activeSeconds: number;
  screenViews: number;
}

export interface DataClausEvent {
  eventId: string;
  userId: string;
  eventType: string;
  timestamp: string;
  sessionId: string;
  payload: Record<string, unknown>;
  device: {
    platform: 'ios' | 'android' | 'web';
    osVersion?: string;
    screenWidth: number;
    screenHeight: number;
  };
}

// Utility functions
const generateId = (): string => {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

const getDeviceInfo = () => {
  const { width, height } = Dimensions.get('window');
  return {
    platform: Platform.OS as 'ios' | 'android' | 'web',
    osVersion: Platform.Version?.toString(),
    screenWidth: width,
    screenHeight: height,
  };
};

/**
 * DataClaus Collector Class
 *
 * Handles data collection, batching, and sending to backend
 */
export class DataClausCollector {
  private config: Required<DataClausConfig>;
  private eventBuffer: DataClausEvent[] = [];
  private sessionId: string;
  private sessionStartTime: Date;
  private screenViews: number = 0;
  private flushTimer?: NodeJS.Timeout;
  private isActive: boolean = false;

  constructor(config: DataClausConfig) {
    this.config = {
      ...config,
      sessionId: config.sessionId || generateId(),
      collectionInterval: config.collectionInterval || 100,
      batchSize: config.batchSize || 50,
      flushInterval: config.flushInterval || 5000,
      debug: config.debug || false,
    };
    this.sessionId = this.config.sessionId;
    this.sessionStartTime = new Date();
  }

  private log(message: string, ...args: unknown[]) {
    if (this.config.debug) {
      console.log(`[DataClaus] ${message}`, ...args);
    }
  }

  /**
   * Start data collection
   */
  start() {
    if (this.isActive) return;
    this.isActive = true;
    this.sessionStartTime = new Date();
    this.log('Collection started');

    // Start periodic flush
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  /**
   * Stop data collection
   */
  stop() {
    if (!this.isActive) return;
    this.isActive = false;
    this.log('Collection stopped');

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Final flush
    this.flush();
  }

  /**
   * Track accelerometer data
   */
  trackAccelerometer(data: { x: number; y: number; z: number }) {
    if (!this.isActive) return;
    this.addEvent('accelerometer', { accelerometer: data });
  }

  /**
   * Track gyroscope data
   */
  trackGyroscope(data: { x: number; y: number; z: number }) {
    if (!this.isActive) return;
    this.addEvent('gyroscope', { gyroscope: data });
  }

  /**
   * Track touch event
   */
  trackTouch(data: TouchData) {
    if (!this.isActive) return;
    this.addEvent('touch', { touch: data });
  }

  /**
   * Track screen view
   */
  trackScreenView(screenName: string) {
    this.screenViews++;
    this.addEvent('screen_view', { screenName, viewNumber: this.screenViews });
  }

  /**
   * Track custom event
   */
  trackCustom(eventType: string, payload: Record<string, unknown>) {
    this.addEvent(eventType, payload);
  }

  /**
   * Add event to buffer
   */
  private addEvent(eventType: string, payload: Record<string, unknown>) {
    const event: DataClausEvent = {
      eventId: generateId(),
      userId: this.config.userId,
      eventType,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      payload,
      device: getDeviceInfo(),
    };

    this.eventBuffer.push(event);
    this.log(`Event added: ${eventType}`, event);

    // Auto-flush if buffer is full
    if (this.eventBuffer.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * Send buffered events to backend
   */
  async flush(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    this.log(`Flushing ${events.length} events`);

    try {
      const response = await fetch(
        `${this.config.backendUrl}/dataclaus/events`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            events,
            session: this.getSessionInfo(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      this.log('Events sent successfully');
    } catch (error) {
      this.log('Failed to send events, re-queuing', error);
      // Re-add events to buffer on failure
      this.eventBuffer = [...events, ...this.eventBuffer];
    }
  }

  /**
   * Get current session info
   */
  getSessionInfo(): SessionInfo {
    const now = new Date();
    const activeSeconds = Math.floor(
      (now.getTime() - this.sessionStartTime.getTime()) / 1000
    );

    return {
      sessionId: this.sessionId,
      startTime: this.sessionStartTime.toISOString(),
      activeSeconds,
      screenViews: this.screenViews,
    };
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }
}

/**
 * React Hook: useDataClaus
 *
 * Main hook for integrating DataClaus into your React Native app
 *
 * Usage:
 * ```tsx
 * const { collector, isCollecting, startCollection, stopCollection } = useDataClaus({
 *   backendUrl: 'https://your-backend.com',
 *   userId: 'user123',
 * });
 * ```
 */
export function useDataClaus(config: DataClausConfig) {
  const collectorRef = useRef<DataClausCollector | null>(null);
  const [isCollecting, setIsCollecting] = useState(false);

  useEffect(() => {
    collectorRef.current = new DataClausCollector(config);

    return () => {
      collectorRef.current?.stop();
    };
  }, [config.backendUrl, config.userId]);

  const startCollection = useCallback(() => {
    collectorRef.current?.start();
    setIsCollecting(true);
  }, []);

  const stopCollection = useCallback(() => {
    collectorRef.current?.stop();
    setIsCollecting(false);
  }, []);

  const trackScreenView = useCallback((screenName: string) => {
    collectorRef.current?.trackScreenView(screenName);
  }, []);

  const trackCustomEvent = useCallback(
    (eventType: string, payload: Record<string, unknown>) => {
      collectorRef.current?.trackCustom(eventType, payload);
    },
    []
  );

  return {
    collector: collectorRef.current,
    isCollecting,
    startCollection,
    stopCollection,
    trackScreenView,
    trackCustomEvent,
    getSessionInfo: () => collectorRef.current?.getSessionInfo(),
  };
}

/**
 * React Hook: useSensorTracking
 *
 * Automatically tracks accelerometer and gyroscope data
 * Requires: expo-sensors
 *
 * Usage:
 * ```tsx
 * import { Accelerometer, Gyroscope } from 'expo-sensors';
 *
 * useSensorTracking(collector, { Accelerometer, Gyroscope });
 * ```
 */
export function useSensorTracking(
  collector: DataClausCollector | null,
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
  },
  options?: { interval?: number }
) {
  const interval = options?.interval || 100;

  useEffect(() => {
    if (!collector) return;

    const subscriptions: Array<{ remove: () => void }> = [];

    if (sensors.Accelerometer) {
      sensors.Accelerometer.setUpdateInterval(interval);
      const sub = sensors.Accelerometer.addListener((data) => {
        collector.trackAccelerometer(data);
      });
      subscriptions.push(sub);
    }

    if (sensors.Gyroscope) {
      sensors.Gyroscope.setUpdateInterval(interval);
      const sub = sensors.Gyroscope.addListener((data) => {
        collector.trackGyroscope(data);
      });
      subscriptions.push(sub);
    }

    return () => {
      subscriptions.forEach((sub) => sub.remove());
    };
  }, [collector, sensors, interval]);
}

// Fraud Detection Module
export {
  FraudDetectionCollector,
  createFraudDetector,
  DEFAULT_CONFIG as FRAUD_DETECTION_CONFIG,
  type FraudMetrics,
  type MotionPattern,
  type ActivityState,
  type ScrollThrottleMetrics,
  type TouchPatternMetrics,
  type BatteryMetrics,
  type PedometerMetrics,
  type FraudSignal,
  type EmulatorSignal,
  type AdaptiveWindowConfig,
} from './fraud-detection';

export {
  useFraudDetection,
  type FraudDetectionHookResult,
  type FraudDetectionState,
} from './useFraudDetection';

// reCAPTCHA Enterprise Module
export {
  DataClausRecaptcha,
  useRecaptcha,
  RecaptchaError,
  RecaptchaErrorType,
  type RecaptchaConfig,
  type RecaptchaResult,
  type RecaptchaAssessment,
  type RecaptchaActionType,
  type UseRecaptchaResult,
} from './recaptcha';

// Default export
export default DataClausCollector;
