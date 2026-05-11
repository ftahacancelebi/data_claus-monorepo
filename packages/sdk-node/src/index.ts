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
  /** DataClaus API URL (default: http://localhost:3002) */
  apiUrl?: string;
  /** Developer ID (your developer UUID) */
  developerId: string;
}

export interface SensorEvent {
  /** Unique event ID (generated if not provided). Used by API as replay guard. */
  eventId?: string;
  /**
   * The DataClaus user id (UUID) representing the end user of your app.
   * Capstone constraint: must match a DataClausUser id.
   */
  externalUserId: string;
  /** Event type: 'accelerometer' | 'gyroscope' | 'touch' | 'scroll' | 'session' | 'screen_view' */
  eventType:
    | 'accelerometer'
    | 'gyroscope'
    | 'touch'
    | 'scroll'
    | 'session'
    | 'screen_view';
  /** Timestamp in ISO 8601 format */
  timestamp: string;
  /**
   * SDK-computed fraud score in [0,1]. 0 = trusted human, 1 = bot.
   * Required by the DataClaus ingest endpoint.
   */
  fraudScore: number;
  /** Sensor payload data */
  payload: SensorPayload;
  /** Session ID to group events */
  sessionId?: string;
  /** Device metadata */
  device?: DeviceInfo;
}

export interface IngestSessionInfo {
  sessionId: string;
  startedAt?: string;
  externalUserId?: string;
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
 * await client.ingestBatch(
 *   [
 *     {
 *       eventId: 'evt-1',
 *       externalUserId: 'dataclaus-user-uuid',
 *       eventType: 'accelerometer',
 *       timestamp: new Date().toISOString(),
 *       fraudScore: 0.12, // computed by mobile SDK
 *       payload: { accelerometer: { x: 0.1, y: 0.2, z: 9.8 } },
 *     },
 *   ],
 *   { session: { sessionId: 'session-uuid' } },
 * );
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
      apiUrl: config.apiUrl || 'http://localhost:3002',
    };
  }

  /**
   * Compute the canonical HMAC signature.
   * Message format: METHOD|PATH|TIMESTAMP|RAW_BODY
   * Secret: the apiKey itself (matches NestJS HmacGuard.computeSignature).
   */
  private signRequest(
    method: string,
    path: string,
    timestamp: string,
    body: string,
  ): string {
    const message = `${method.toUpperCase()}|${path}|${timestamp}|${body}`;
    return crypto
      .createHmac('sha256', this.config.apiKey)
      .update(message)
      .digest('hex');
  }

  /**
   * Generate a unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Ingest multiple sensor events in a batch (HMAC-protected).
   *
   * Wire format matches NestJS IngestBatchDto (camelCase, see the
   * dataclaus-nestjs-api ingest module).
   */
  async ingestBatch(
    events: SensorEvent[],
    options: {
      session: IngestSessionInfo;
      recaptchaToken?: string;
    },
  ): Promise<BatchIngestResponse> {
    if (!Array.isArray(events) || events.length === 0) {
      throw new Error('ingestBatch: events array is empty');
    }
    if (events.length > 100) {
      throw new Error('ingestBatch: max 100 events per request');
    }

    const processedEvents = events.map((event) => {
      if (typeof event.fraudScore !== 'number') {
        throw new Error(
          `ingestBatch: event ${event.eventId ?? '<no-id>'} missing fraudScore`,
        );
      }
      return {
        eventId: event.eventId || this.generateEventId(),
        externalUserId: event.externalUserId,
        eventType: event.eventType,
        timestamp: event.timestamp,
        fraudScore: event.fraudScore,
        payload: event.payload,
        sessionId: event.sessionId,
        device: event.device,
      };
    });

    const requestBody = {
      events: processedEvents,
      session: options.session,
      recaptchaToken: options.recaptchaToken,
    };
    const body = JSON.stringify(requestBody);
    const path = '/v1/ingest/batch';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = this.signRequest('POST', path, timestamp, body);

    const response = await fetch(`${this.config.apiUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
      },
      body,
    });

    if (!response.ok) {
      const error = (await response
        .json()
        .catch(() => ({ message: 'Unknown error' }))) as {
        message?: string;
        error?: string;
      };
      throw new Error(
        `DataClaus API error: ${error.message || error.error || response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      accepted: number;
      rejected: number;
      scoredEventIds: string[];
      rejections: { eventId: string; reason: string }[];
    };

    return {
      success: true,
      processedCount: data.accepted,
      errors: data.rejections.map((r) => ({
        eventId: r.eventId,
        error: r.reason,
      })),
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

// Data Packages
export {
  DataClausPackager,
  RecurringExporter,
  type PackagerConfig,
  type CreatePackageInput,
  type CreatePackageResult,
  type RecurringTemplate,
} from './packager';

export {
  inferSchema,
  pickSampleRows,
  computeClaimedMetrics,
} from './packager-helpers';

export {
  PackagerError,
  type PackagerErrorCode,
} from './packager-errors';

export type {
  ClaimedMetrics,
  PackageStatus,
  SchemaJson,
  Row,
} from './types';

// Default export
export default DataClausClient;
