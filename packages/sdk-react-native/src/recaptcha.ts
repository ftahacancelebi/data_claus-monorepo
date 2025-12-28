/**
 * DataClaus reCAPTCHA Enterprise Integration
 * ==========================================
 *
 * Seamless integration of Google reCAPTCHA Enterprise for bot detection.
 * This module handles:
 * - Client initialization
 * - Token generation for various actions
 * - Backend verification coordination
 * - Error handling with developer-friendly messages
 *
 * The developer using this SDK doesn't need to worry about:
 * - Managing reCAPTCHA lifecycle
 * - Token expiration (2 minutes)
 * - Action formatting
 * - Connection issues (with retry logic)
 *
 * Installation:
 *   npx yarn add @google-cloud/recaptcha-enterprise-react-native
 *
 * iOS Setup (Podfile):
 *   use_frameworks! :linkage => :static
 *   flipper_config = FlipperConfiguration.disabled
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// Import from Google's official package
import {
  Recaptcha,
  RecaptchaAction,
  type RecaptchaClient,
} from '@google-cloud/recaptcha-enterprise-react-native';

// ============================================
// TYPES
// ============================================

/**
 * Predefined actions that reCAPTCHA Enterprise supports
 */
export type RecaptchaActionType = 'login' | 'signup' | 'checkout' | 'custom';

/**
 * Result of a reCAPTCHA verification
 */
export interface RecaptchaResult {
  /** The reCAPTCHA token to send to backend */
  token: string;
  /** The action that was verified */
  action: string;
  /** Timestamp when token was generated */
  timestamp: number;
  /** Token expires in 2 minutes */
  expiresAt: number;
}

/**
 * Server-side assessment result from Google
 */
export interface RecaptchaAssessment {
  /** Whether the request is likely legitimate (score >= threshold) */
  isBot: boolean;
  /** Risk score from 0.0 (bot) to 1.0 (human) */
  score: number;
  /** Reasons for the score */
  reasons: string[];
  /** Expected action matches */
  actionValid: boolean;
  /** Token was valid and not expired */
  tokenValid: boolean;
  /** Raw assessment data */
  raw?: Record<string, unknown>;
}

/**
 * Configuration for the reCAPTCHA module
 */
export interface RecaptchaConfig {
  /** Your reCAPTCHA Enterprise Site Key (from Google Cloud Console) */
  siteKey: string;
  /** Backend URL for token verification */
  backendUrl?: string;
  /** Score threshold (0.0-1.0, default 0.5). Below = bot */
  scoreThreshold?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Maximum retry attempts for network errors */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelayMs?: number;
}

/**
 * Error types for better handling
 */
export enum RecaptchaErrorType {
  NOT_INITIALIZED = 'NOT_INITIALIZED',
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  TOKEN_GENERATION_FAILED = 'TOKEN_GENERATION_FAILED',
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_ACTION = 'INVALID_ACTION',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
}

export class RecaptchaError extends Error {
  type: RecaptchaErrorType;
  originalError?: Error;

  constructor(
    type: RecaptchaErrorType,
    message: string,
    originalError?: Error
  ) {
    super(message);
    this.name = 'RecaptchaError';
    this.type = type;
    this.originalError = originalError;
  }
}

// ============================================
// RECAPTCHA CLIENT CLASS
// ============================================

/**
 * DataClaus reCAPTCHA Client
 *
 * Provides a simple, developer-friendly interface to Google reCAPTCHA Enterprise.
 *
 * Usage:
 * ```typescript
 * const recaptcha = new DataClausRecaptcha({
 *   siteKey: 'YOUR_SITE_KEY',
 *   backendUrl: 'https://your-backend.com'
 * });
 *
 * await recaptcha.initialize();
 *
 * // Check if user is a bot during login
 * const result = await recaptcha.verifyAction('login');
 * if (result.isBot) {
 *   // Handle bot
 * }
 * ```
 */
export class DataClausRecaptcha {
  private config: Required<RecaptchaConfig>;
  private client: RecaptchaClient | null = null;
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor(config: RecaptchaConfig) {
    this.config = {
      siteKey: config.siteKey,
      backendUrl: config.backendUrl || '',
      scoreThreshold: config.scoreThreshold ?? 0.5,
      debug: config.debug ?? false,
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
    };
  }

  private log(message: string, ...args: unknown[]): void {
    if (this.config.debug) {
      console.log(`[DataClausRecaptcha] ${message}`, ...args);
    }
  }

  private logError(message: string, error?: unknown): void {
    console.error(`[DataClausRecaptcha] ${message}`, error);
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Initialize the reCAPTCHA client.
   *
   * This should be called once during app startup.
   * The SDK handles multiple calls gracefully (returns cached client).
   *
   * @throws RecaptchaError if initialization fails
   */
  async initialize(): Promise<void> {
    // Return existing promise if initialization is in progress
    if (this.initPromise) {
      return this.initPromise;
    }

    // Return immediately if already initialized
    if (this.isInitialized && this.client) {
      this.log('Already initialized');
      return;
    }

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      this.log(
        'Initializing with site key:',
        this.config.siteKey.substring(0, 10) + '...'
      );

      // Fetch the client from Google reCAPTCHA Enterprise
      this.client = await Recaptcha.fetchClient(this.config.siteKey);

      this.isInitialized = true;
      this.log('Initialization successful');
    } catch (error) {
      this.logError('Initialization failed', error);
      this.initPromise = null;

      throw new RecaptchaError(
        RecaptchaErrorType.INITIALIZATION_FAILED,
        `Failed to initialize reCAPTCHA: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        error instanceof Error ? error : undefined
      );
    }
  }

  // ============================================
  // TOKEN GENERATION
  // ============================================

  /**
   * Generate a reCAPTCHA token for a specific action.
   *
   * @param action - The action type ('login', 'signup', 'checkout', or custom)
   * @param customActionName - Required if action is 'custom'
   * @returns The reCAPTCHA token result
   */
  async getToken(
    action: RecaptchaActionType,
    customActionName?: string
  ): Promise<RecaptchaResult> {
    // Ensure initialized
    if (!this.isInitialized || !this.client) {
      await this.initialize();
    }

    if (!this.client) {
      throw new RecaptchaError(
        RecaptchaErrorType.NOT_INITIALIZED,
        'reCAPTCHA client not initialized'
      );
    }

    // Get the appropriate action
    const recaptchaAction = this._getRecaptchaAction(action, customActionName);
    const actionName =
      action === 'custom' ? customActionName! : action.toUpperCase();

    this.log(`Generating token for action: ${actionName}`);

    let lastError: Error | undefined;

    // Retry logic for network issues
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const token = await this.client.execute(recaptchaAction);

        const now = Date.now();
        const result: RecaptchaResult = {
          token,
          action: actionName,
          timestamp: now,
          expiresAt: now + 2 * 60 * 1000, // 2 minutes
        };

        this.log(`Token generated successfully for ${actionName}`);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logError(`Token generation attempt ${attempt} failed`, error);

        if (attempt < this.config.maxRetries) {
          await this._delay(this.config.retryDelayMs * attempt);
        }
      }
    }

    throw new RecaptchaError(
      RecaptchaErrorType.TOKEN_GENERATION_FAILED,
      `Failed to generate token after ${this.config.maxRetries} attempts`,
      lastError
    );
  }

  private _getRecaptchaAction(
    action: RecaptchaActionType,
    customName?: string
  ): ReturnType<typeof RecaptchaAction.LOGIN> {
    switch (action) {
      case 'login':
        return RecaptchaAction.LOGIN();
      case 'signup':
        return RecaptchaAction.SIGNUP();
      case 'checkout':
        // Use custom action for checkout since it's not a built-in
        return RecaptchaAction.custom('CHECKOUT');
      case 'custom':
        if (!customName) {
          throw new RecaptchaError(
            RecaptchaErrorType.INVALID_ACTION,
            'Custom action name is required when action is "custom"'
          );
        }
        return RecaptchaAction.custom(customName);
      default:
        throw new RecaptchaError(
          RecaptchaErrorType.INVALID_ACTION,
          `Invalid action type: ${action}`
        );
    }
  }

  // ============================================
  // FULL VERIFICATION FLOW
  // ============================================

  /**
   * Verify an action and check if the user is a bot.
   *
   * This is the main method developers should use. It:
   * 1. Generates a reCAPTCHA token
   * 2. Sends it to your backend for verification
   * 3. Returns the assessment result
   *
   * @param action - The action to verify
   * @param customActionName - Custom action name (if action is 'custom')
   * @param additionalData - Optional data to send with verification
   * @returns Assessment result including bot detection
   */
  async verifyAction(
    action: RecaptchaActionType,
    customActionName?: string,
    additionalData?: Record<string, unknown>
  ): Promise<RecaptchaAssessment> {
    if (!this.config.backendUrl) {
      throw new RecaptchaError(
        RecaptchaErrorType.VERIFICATION_FAILED,
        'Backend URL is required for verification. Set backendUrl in config or use getToken() for manual verification.'
      );
    }

    // Get the token
    const tokenResult = await this.getToken(action, customActionName);

    // Send to backend for verification
    return this._verifyWithBackend(tokenResult, additionalData);
  }

  private async _verifyWithBackend(
    tokenResult: RecaptchaResult,
    additionalData?: Record<string, unknown>
  ): Promise<RecaptchaAssessment> {
    const endpoint = `${this.config.backendUrl}/dataclaus/recaptcha/verify`;

    this.log(`Verifying token with backend: ${endpoint}`);

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: tokenResult.token,
            action: tokenResult.action,
            timestamp: tokenResult.timestamp,
            ...additionalData,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        const assessment: RecaptchaAssessment = {
          isBot: data.score < this.config.scoreThreshold,
          score: data.score ?? 0,
          reasons: data.reasons ?? [],
          actionValid: data.actionValid ?? true,
          tokenValid: data.tokenValid ?? true,
          raw: data.raw,
        };

        this.log(
          `Verification complete: score=${assessment.score}, isBot=${assessment.isBot}`
        );
        return assessment;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logError(`Verification attempt ${attempt} failed`, error);

        if (attempt < this.config.maxRetries) {
          await this._delay(this.config.retryDelayMs * attempt);
        }
      }
    }

    throw new RecaptchaError(
      RecaptchaErrorType.NETWORK_ERROR,
      `Failed to verify with backend after ${this.config.maxRetries} attempts`,
      lastError
    );
  }

  // ============================================
  // UTILITIES
  // ============================================

  private _delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if a token is still valid (not expired)
   */
  isTokenValid(result: RecaptchaResult): boolean {
    return Date.now() < result.expiresAt;
  }

  /**
   * Get remaining time before token expires (in seconds)
   */
  getTokenRemainingTime(result: RecaptchaResult): number {
    const remaining = result.expiresAt - Date.now();
    return Math.max(0, Math.floor(remaining / 1000));
  }

  /**
   * Check if client is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.client !== null;
  }
}

// ============================================
// REACT HOOK
// ============================================

/**
 * React hook for easy reCAPTCHA integration
 *
 * Usage:
 * ```tsx
 * function LoginScreen() {
 *   const { verifyAction, isReady, isLoading, error } = useRecaptcha({
 *     siteKey: 'YOUR_SITE_KEY',
 *     backendUrl: 'https://your-backend.com'
 *   });
 *
 *   const handleLogin = async () => {
 *     const result = await verifyAction('login');
 *     if (result.isBot) {
 *       alert('Bot detected!');
 *       return;
 *     }
 *     // Proceed with login
 *   };
 * }
 * ```
 */
export interface UseRecaptchaResult {
  /** Whether the client is initialized and ready */
  isReady: boolean;
  /** Whether a verification is in progress */
  isLoading: boolean;
  /** Last error that occurred */
  error: RecaptchaError | null;
  /** The underlying client instance */
  client: DataClausRecaptcha | null;

  /** Get a reCAPTCHA token for an action */
  getToken: (
    action: RecaptchaActionType,
    customActionName?: string
  ) => Promise<RecaptchaResult>;

  /** Verify an action and get bot assessment */
  verifyAction: (
    action: RecaptchaActionType,
    customActionName?: string,
    additionalData?: Record<string, unknown>
  ) => Promise<RecaptchaAssessment>;

  /** Clear the last error */
  clearError: () => void;
}

export function useRecaptcha(config: RecaptchaConfig): UseRecaptchaResult {
  const clientRef = useRef<DataClausRecaptcha | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<RecaptchaError | null>(null);

  // Initialize on mount
  useEffect(() => {
    const client = new DataClausRecaptcha(config);
    clientRef.current = client;

    client
      .initialize()
      .then(() => {
        setIsReady(true);
      })
      .catch((err) => {
        setError(
          err instanceof RecaptchaError
            ? err
            : new RecaptchaError(
                RecaptchaErrorType.INITIALIZATION_FAILED,
                err.message,
                err
              )
        );
      });

    // Cleanup not needed - client is stateless after init
  }, [config.siteKey]);

  const getToken = useCallback(
    async (
      action: RecaptchaActionType,
      customActionName?: string
    ): Promise<RecaptchaResult> => {
      if (!clientRef.current) {
        throw new RecaptchaError(
          RecaptchaErrorType.NOT_INITIALIZED,
          'reCAPTCHA not initialized'
        );
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await clientRef.current.getToken(
          action,
          customActionName
        );
        return result;
      } catch (err) {
        const recaptchaError =
          err instanceof RecaptchaError
            ? err
            : new RecaptchaError(
                RecaptchaErrorType.TOKEN_GENERATION_FAILED,
                err instanceof Error ? err.message : 'Unknown error',
                err instanceof Error ? err : undefined
              );
        setError(recaptchaError);
        throw recaptchaError;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const verifyAction = useCallback(
    async (
      action: RecaptchaActionType,
      customActionName?: string,
      additionalData?: Record<string, unknown>
    ): Promise<RecaptchaAssessment> => {
      if (!clientRef.current) {
        throw new RecaptchaError(
          RecaptchaErrorType.NOT_INITIALIZED,
          'reCAPTCHA not initialized'
        );
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await clientRef.current.verifyAction(
          action,
          customActionName,
          additionalData
        );
        return result;
      } catch (err) {
        const recaptchaError =
          err instanceof RecaptchaError
            ? err
            : new RecaptchaError(
                RecaptchaErrorType.VERIFICATION_FAILED,
                err instanceof Error ? err.message : 'Unknown error',
                err instanceof Error ? err : undefined
              );
        setError(recaptchaError);
        throw recaptchaError;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isReady,
    isLoading,
    error,
    client: clientRef.current,
    getToken,
    verifyAction,
    clearError,
  };
}

// ============================================
// EXPORTS
// ============================================

export default DataClausRecaptcha;
