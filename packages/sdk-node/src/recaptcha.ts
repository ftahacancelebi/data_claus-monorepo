/**
 * DataClaus reCAPTCHA Enterprise Server-Side Verification
 * ========================================================
 *
 * This module handles server-side verification of reCAPTCHA tokens
 * using Google's reCAPTCHA Enterprise createAssessment API.
 *
 * The developer using this SDK gets:
 * - Simple API to verify tokens
 * - Automatic Google Cloud authentication
 * - Risk analysis and bot detection score
 * - Action validation
 *
 * Prerequisites:
 * 1. Enable reCAPTCHA Enterprise API in Google Cloud Console
 * 2. Create a reCAPTCHA Enterprise key
 * 3. Set up authentication (service account or ADC)
 *
 * Installation:
 *   npm install @google-cloud/recaptcha-enterprise
 */

import { RecaptchaEnterpriseServiceClient } from '@google-cloud/recaptcha-enterprise';

// ============================================
// TYPES
// ============================================

export interface RecaptchaVerifyRequest {
  /** The reCAPTCHA token from the client */
  token: string;
  /** The expected action (must match client-side action) */
  expectedAction: string;
  /** User's IP address (optional but recommended) */
  userIpAddress?: string;
  /** User agent string (optional) */
  userAgent?: string;
  /** User ID in your system (for tracking) */
  userId?: string;
}

export interface RecaptchaVerifyResult {
  /** Is this likely a bot? (score below threshold) */
  isBot: boolean;
  /** Risk score: 0.0 (definitely bot) to 1.0 (definitely human) */
  score: number;
  /** Whether the token is valid */
  tokenValid: boolean;
  /** Whether the action matches what was expected */
  actionValid: boolean;
  /** Reasons explaining the score */
  reasons: string[];
  /** Risk assessment details */
  riskAnalysis: {
    score: number;
    reasons: string[];
  };
  /** Fraud prevention signals */
  fraudPrevention?: {
    transactionRisk: number;
    stolenInstrumentVerdict: string;
    cardTestingVerdict: string;
  };
  /** Assessment name for reference */
  assessmentName: string;
  /** Raw response from Google (for debugging) */
  raw?: Record<string, unknown>;
}

export interface RecaptchaServerConfig {
  /** Google Cloud Project ID */
  projectId: string;
  /** reCAPTCHA Enterprise Site Key */
  siteKey: string;
  /** Score threshold (default 0.5). Below this = bot */
  scoreThreshold?: number;
  /** Path to service account key file (optional if using ADC) */
  keyFilePath?: string;
  /** Enable debug logging */
  debug?: boolean;
}

// ============================================
// SERVER-SIDE VERIFICATION CLASS
// ============================================

/**
 * Server-side reCAPTCHA Enterprise verification.
 *
 * Usage:
 * ```typescript
 * const verifier = new RecaptchaVerifier({
 *   projectId: 'your-project-id',
 *   siteKey: 'your-site-key'
 * });
 *
 * const result = await verifier.verify({
 *   token: req.body.token,
 *   expectedAction: 'LOGIN',
 *   userIpAddress: req.ip
 * });
 *
 * if (result.isBot) {
 *   res.status(403).json({ error: 'Bot detected' });
 *   return;
 * }
 * ```
 */
// Import DataClausClient type (circular dependency workaround likely needed or just interface)
import { DataClausClient } from './index';

export class RecaptchaVerifier {
  private config: Required<Omit<RecaptchaServerConfig, 'keyFilePath'>> & {
    keyFilePath?: string;
  };
  private client: RecaptchaEnterpriseServiceClient;
  private analyticsClient?: DataClausClient;

  constructor(
    config: RecaptchaServerConfig,
    analyticsClient?: DataClausClient
  ) {
    this.config = {
      projectId: config.projectId,
      siteKey: config.siteKey,
      scoreThreshold: config.scoreThreshold ?? 0.5,
      keyFilePath: config.keyFilePath,
      debug: config.debug ?? false,
    };

    this.analyticsClient = analyticsClient;

    // Initialize the reCAPTCHA Enterprise client
    const clientOptions: { keyFilename?: string } = {};
    if (config.keyFilePath) {
      clientOptions.keyFilename = config.keyFilePath;
    }

    this.client = new RecaptchaEnterpriseServiceClient(clientOptions);
  }

  private log(message: string, ...args: unknown[]): void {
    if (this.config.debug) {
      console.log(`[RecaptchaVerifier] ${message}`, ...args);
    }
  }

  /**
   * Verify a reCAPTCHA token and get assessment.
   *
   * @param request - Verification request with token and action
   * @returns Verification result with bot detection
   */
  async verify(
    request: RecaptchaVerifyRequest
  ): Promise<RecaptchaVerifyResult> {
    this.log('Verifying token for action:', request.expectedAction);

    const projectPath = this.client.projectPath(this.config.projectId);

    try {
      // Build the assessment request
      const assessmentRequest = {
        parent: projectPath,
        assessment: {
          event: {
            token: request.token,
            siteKey: this.config.siteKey,
            userIpAddress: request.userIpAddress,
            userAgent: request.userAgent,
            expectedAction: request.expectedAction,
          },
        },
      };

      // Create assessment
      const [assessment] = await this.client.createAssessment(
        assessmentRequest
      );

      this.log('Assessment created:', assessment.name);

      // Extract risk analysis
      const tokenProperties = assessment.tokenProperties;
      const riskAnalysis = assessment.riskAnalysis;

      // Check if token is valid
      const tokenValid = tokenProperties?.valid === true;

      // Check if action matches
      const actionValid = tokenProperties?.action === request.expectedAction;

      // Get the score (0.0 = bot, 1.0 = human)
      const score = riskAnalysis?.score ?? 0;

      // Get reasons
      const reasons: string[] = [];
      if (riskAnalysis?.reasons) {
        for (const reason of riskAnalysis.reasons) {
          reasons.push(String(reason));
        }
      }

      // Check for invalid token reasons
      if (!tokenValid && tokenProperties?.invalidReason) {
        reasons.push(`INVALID_TOKEN: ${tokenProperties.invalidReason}`);
      }

      // Determine if bot
      const isBot = score < this.config.scoreThreshold || !tokenValid;

      const result: RecaptchaVerifyResult = {
        isBot,
        score,
        tokenValid,
        actionValid,
        reasons,
        riskAnalysis: {
          score,
          reasons,
        },
        assessmentName: assessment.name || '',
      };

      // Add fraud prevention signals if available
      if (assessment.fraudPreventionAssessment) {
        result.fraudPrevention = {
          transactionRisk:
            assessment.fraudPreventionAssessment.transactionRisk ?? 0,
          stolenInstrumentVerdict: String(
            assessment.fraudPreventionAssessment.stolenInstrumentVerdict
          ),
          cardTestingVerdict: String(
            assessment.fraudPreventionAssessment.cardTestingVerdict
          ),
        };
      }

      if (this.config.debug) {
        result.raw = assessment as unknown as Record<string, unknown>;
      }

      this.log(
        `Verification complete: score=${score}, isBot=${isBot}, valid=${tokenValid}`
      );

      // REPORT TO DATACLAUS ANALYTICS (Fire and Forget)
      if (this.analyticsClient && request.userId) {
        this.analyticsClient
          .ingest({
            userId: request.userId,
            eventType: 'recaptcha_assessment',
            timestamp: new Date().toISOString(),
            payload: {
              raw: {
                score,
                is_bot: isBot,
                valid: tokenValid,
                action: request.expectedAction,
                reasons,
                assessment_id: assessment.name,
              },
            },
          })
          .catch((err) => {
            this.log('Failed to report analytics to DataClaus:', err);
          });
      }

      return result;
    } catch (error) {
      this.log('Verification error:', error);
      throw new Error(
        `reCAPTCHA verification failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Annotate an assessment to improve the model.
   *
   * Call this after you determine the true nature of a transaction
   * (e.g., if a login was actually fraudulent).
   *
   * @param assessmentName - The assessment name from verify result
   * @param annotation - Whether this was legitimate or fraudulent
   * @param reasons - Optional reasons for the annotation
   */
  async annotateAssessment(
    assessmentName: string,
    annotation:
      | 'LEGITIMATE'
      | 'FRAUDULENT'
      | 'PASSWORD_CORRECT'
      | 'PASSWORD_INCORRECT',
    reasons?: string[]
  ): Promise<void> {
    this.log(`Annotating assessment: ${assessmentName} as ${annotation}`);

    try {
      await this.client.annotateAssessment({
        name: assessmentName,
        annotation: annotation as unknown as number,
        reasons: reasons as unknown as number[],
      });

      this.log('Assessment annotated successfully');
    } catch (error) {
      this.log('Annotation error:', error);
      throw new Error(
        `Failed to annotate assessment: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }
}

// ============================================
// EXPRESS MIDDLEWARE
// ============================================

/**
 * Express middleware for reCAPTCHA verification.
 *
 * Usage:
 * ```typescript
 * import { createRecaptchaMiddleware } from '@dataclaus/sdk-node';
 *
 * const recaptcha = createRecaptchaMiddleware({
 *   projectId: 'your-project-id',
 *   siteKey: 'your-site-key'
 * });
 *
 * app.post('/login', recaptcha('LOGIN'), (req, res) => {
 *   // reCAPTCHA passed, req.recaptcha contains assessment
 *   if (req.recaptcha.isBot) {
 *     return res.status(403).json({ error: 'Bot detected' });
 *   }
 *   // Proceed with login
 * });
 * ```
 */
export interface RecaptchaMiddlewareOptions extends RecaptchaServerConfig {
  /** Header name containing the token (default: 'x-recaptcha-token') */
  tokenHeader?: string;
  /** Body field containing the token (default: 'recaptchaToken') */
  tokenBody?: string;
  /** Block bots automatically (default: true) */
  blockBots?: boolean;
}

// Extended Request type for middleware
declare global {
  namespace Express {
    interface Request {
      recaptcha?: RecaptchaVerifyResult;
    }
  }
}

export function createRecaptchaMiddleware(options: RecaptchaMiddlewareOptions) {
  const verifier = new RecaptchaVerifier(options);
  const tokenHeader = options.tokenHeader ?? 'x-recaptcha-token';
  const tokenBody = options.tokenBody ?? 'recaptchaToken';
  const blockBots = options.blockBots ?? true;

  return (expectedAction: string) => {
    return async (
      req: {
        headers: Record<string, string | string[] | undefined>;
        body?: Record<string, unknown>;
        ip?: string;
        recaptcha?: RecaptchaVerifyResult;
      },
      res: {
        status: (code: number) => {
          json: (body: Record<string, unknown>) => void;
        };
      },
      next: (error?: Error) => void
    ) => {
      // Get token from header or body
      const headerToken = req.headers[tokenHeader.toLowerCase()];
      const token =
        (typeof headerToken === 'string' ? headerToken : undefined) ||
        (req.body?.[tokenBody] as string | undefined);

      if (!token) {
        if (blockBots) {
          return res.status(400).json({
            error: 'reCAPTCHA token is required',
            code: 'RECAPTCHA_TOKEN_MISSING',
          });
        }
        return next();
      }

      try {
        const result = await verifier.verify({
          token,
          expectedAction,
          userIpAddress: req.ip,
          userAgent: req.headers['user-agent'] as string | undefined,
        });

        // Attach result to request
        req.recaptcha = result;

        // Block bots if configured
        if (blockBots && result.isBot) {
          return res.status(403).json({
            error: 'Bot activity detected',
            code: 'RECAPTCHA_BOT_DETECTED',
            score: result.score,
          });
        }

        next();
      } catch (error) {
        console.error('[RecaptchaMiddleware] Verification error:', error);

        if (blockBots) {
          return res.status(500).json({
            error: 'reCAPTCHA verification failed',
            code: 'RECAPTCHA_ERROR',
          });
        }

        next();
      }
    };
  };
}

// ============================================
// EXPORTS
// ============================================

export default RecaptchaVerifier;
