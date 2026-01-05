/**
 * DataClaus Node.js SDK
 *
 * This SDK is used by developers to proxy sensor data from their backend
 * to the DataClaus API with HMAC authentication.
 *
 * Flow: Mobile App -> Developer's Node.js Backend -> DataClaus API
 */

import crypto from 'crypto';
import fetch from 'node-fetch';

export interface DataClausConfig {
  /** Your DataClaus API Key (the raw key returned when generating) */
  apiKey: string;
  /** DataClaus API URL (default: http://localhost:3000) */
  apiUrl?: string;
  /** Developer ID (your developer UUID) */
  developerId: string;
}

export interface SensorEvent {
  /** Unique event ID (generated if not provided) */
  eventId?: string;
  /** User ID in your system */
  userId: string;
  /** Event type: 'accelerometer' | 'gyroscope' | 'touch' | 'scroll' | 'session' */
  eventType: string;
  /** Timestamp in ISO format */
  timestamp: string;
  /** Sensor payload data */
  payload: SensorPayload;
  /** Optional campaign ID for targeting */
  campaignId?: string;
  /** Session ID to group events */
  sessionId?: string;
  /** Device metadata */
  device?: DeviceInfo;
}

export interface SensorPayload {
  /** Accelerometer data */
  accelerometer?: { x: number; y: number; z: number };
  /** Gyroscope data */
  gyroscope?: { x: number; y: number; z: number };
  /** Touch biometrics */
  touch?: {
    pressure?: number;
    duration?: number;
    area?: number;
    velocity?: number;
  };
  /** Scroll patterns */
  scroll?: {
    direction: 'up' | 'down' | 'left' | 'right';
    velocity: number;
    distance: number;
  };
  /** Session data */
  session?: {
    startTime: string;
    endTime?: string;
    activeSeconds: number;
    screenViews?: number;
  };
  /** Raw data for custom events */
  raw?: Record<string, unknown>;
}

export interface DeviceInfo {
  platform: 'ios' | 'android' | 'web';
  osVersion?: string;
  model?: string;
  appVersion?: string;
  timezone?: string;
  locale?: string;
}

export interface IngestResponse {
  success: boolean;
  eventId: string;
  message?: string;
}

export interface BatchIngestResponse {
  success: boolean;
  processedCount: number;
  errors?: Array<{ eventId: string; error: string }>;
}

/**
 * DataClaus SDK Client
 *
 * Usage:
 * ```typescript
 * const client = new DataClausClient({
 *   apiKey: 'your_api_key_from_dashboard',
 *   developerId: 'your_developer_uuid'
 * });
 *
 * await client.ingest({
 *   userId: 'user123',
 *   eventType: 'accelerometer',
 *   timestamp: new Date().toISOString(),
 *   payload: {
 *     accelerometer: { x: 0.1, y: 0.2, z: 9.8 }
 *   }
 * });
 * ```
 */
export class DataClausClient {
  private config: Required<DataClausConfig>;

  constructor(config: DataClausConfig) {
    if (!config.apiKey) {
      throw new Error('DataClaus: apiKey is required');
    }
    if (!config.developerId) {
      throw new Error('DataClaus: developerId is required');
    }

    this.config = {
      ...config,
      apiUrl: config.apiUrl || 'http://localhost:3000',
    };
  }

  /**
   * Generate HMAC signature for the request body
   * Uses the API Key as the HMAC secret (matching API's hmac.go implementation)
   */
  private generateSignature(body: string): string {
    return crypto
      .createHmac('sha256', this.config.apiKey)
      .update(body)
      .digest('hex');
  }

  /**
   * Generate a unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Ingest a single sensor event
   */
  async ingest(event: SensorEvent): Promise<IngestResponse> {
    const eventId = event.eventId || this.generateEventId();

    const payload = {
      event_id: eventId,
      developer_id: this.config.developerId,
      user_id: event.userId,
      event_type: event.eventType,
      timestamp: event.timestamp,
      payload: event.payload,
      campaign_id: event.campaignId,
      session_id: event.sessionId,
      device: event.device,
    };

    const body = JSON.stringify(payload);
    const signature = this.generateSignature(body);

    const response = await fetch(`${this.config.apiUrl}/v1/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey,
        'X-Signature': signature,
      },
      body,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: 'Unknown error' }));
      throw new Error(
        `DataClaus API error: ${error.error || response.statusText}`
      );
    }

    return {
      success: true,
      eventId,
      message: 'Event ingested successfully',
    };
  }

  /**
   * Ingest multiple sensor events in a batch
   */
  async ingestBatch(events: SensorEvent[]): Promise<BatchIngestResponse> {
    const processedEvents = events.map((event) => ({
      event_id: event.eventId || this.generateEventId(),
      developer_id: this.config.developerId,
      user_id: event.userId,
      event_type: event.eventType,
      timestamp: event.timestamp,
      payload: event.payload,
      campaign_id: event.campaignId,
      session_id: event.sessionId,
      device: event.device,
    }));

    const payload = { events: processedEvents };
    const body = JSON.stringify(payload);
    const signature = this.generateSignature(body);

    const response = await fetch(`${this.config.apiUrl}/v1/ingest/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey,
        'X-Signature': signature,
      },
      body,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: 'Unknown error' }));
      throw new Error(
        `DataClaus API error: ${error.error || response.statusText}`
      );
    }

    return {
      success: true,
      processedCount: events.length,
    };
  }

  /**
   * Verify the SDK configuration by making a health check
   */
  async verify(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.apiUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

// reCAPTCHA Enterprise Server-Side Verification
export {
  RecaptchaVerifier,
  createRecaptchaMiddleware,
  type RecaptchaVerifyRequest,
  type RecaptchaVerifyResult,
  type RecaptchaServerConfig,
  type RecaptchaMiddlewareOptions,
} from './recaptcha';

// Authentication Module
export {
  DataClausAuth,
  type DataClausAuthConfig,
  type DataClausUser,
  type UserEarnings,
  type AdImpressionResult,
  type AdConfig,
  type AdRates,
  type AdRevenueSummary,
  type TopEarner,
} from './auth';

// Default export
export default DataClausClient;
