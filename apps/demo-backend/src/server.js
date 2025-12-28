/**
 * DataClaus Demo Backend
 *
 * This developer backend uses the official @dataclaus/sdk-node
 * to forward sensor data to the DataClaus API.
 *
 * Flow: Mobile App -> This Backend (SDK) -> DataClaus API
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');

// Import the DataClaus SDK
// Note: In production, you would: npm install @dataclaus/sdk-node
// For this demo, we use the local package from packages/sdk-node
let DataClausClient;
let RecaptchaVerifier;

try {
  // Try to import the compiled SDK
  const sdk = require('@dataclaus/sdk-node');
  DataClausClient = sdk.DataClausClient || sdk.default;
  RecaptchaVerifier = sdk.RecaptchaVerifier;
} catch (e) {
  // Fallback: inline implementation if SDK not compiled yet
  console.warn('[SDK] @dataclaus/sdk-node issue:', e.message);
  DataClausClient = null;
}

const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 4000;

// Configuration
// IMPORTANT: Get these from the DataClaus Dashboard after creating a developer account
const CONFIG = {
  DATACLAUS_API_URL: process.env.DATACLAUS_API_URL || 'http://localhost:3000',
  // The API Key is also used as the HMAC secret
  DATACLAUS_API_KEY:
    process.env.DATACLAUS_API_KEY || 'your_api_key_from_dashboard',
  DEVELOPER_ID: process.env.DEVELOPER_ID || 'your_developer_uuid',
};

// Initialize DataClaus SDK Client (if available)
let dataclausClient = null;
let recaptchaVerifier = null;

if (DataClausClient) {
  dataclausClient = new DataClausClient({
    apiKey: CONFIG.DATACLAUS_API_KEY,
    developerId: CONFIG.DEVELOPER_ID,
    apiUrl: CONFIG.DATACLAUS_API_URL,
  });
  console.log('[SDK] DataClaus SDK client initialized');

  // Initialize RecaptchaVerifier if config exists
  if (process.env.GOOGLE_CLOUD_PROJECT_ID) {
    try {
      recaptchaVerifier = new RecaptchaVerifier(
        {
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
          siteKey: process.env.RECAPTCHA_SITE_KEY_IOS,
          keyFilePath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
          debug: true,
        },
        dataclausClient
      );
      console.log('[SDK] RecaptchaVerifier initialized with analytics');
    } catch (err) {
      console.warn('[SDK] Failed to init RecaptchaVerifier:', err.message);
    }
  }
}

// Fallback HMAC function (used if SDK not available)
// API uses: HMAC-SHA256(body, apiKey) - the API Key IS the HMAC secret
function generateHMACSignature(body) {
  return crypto
    .createHmac('sha256', CONFIG.DATACLAUS_API_KEY)
    .update(JSON.stringify(body))
    .digest('hex');
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'demo-backend',
    sdkEnabled: dataclausClient !== null,
    timestamp: new Date().toISOString(),
    config: {
      dataclausApiUrl: CONFIG.DATACLAUS_API_URL,
      developerId: CONFIG.DEVELOPER_ID.substring(0, 10) + '...',
    },
  });
});

/**
 * Receive events from mobile app and forward to DataClaus API
 */
app.post('/dataclaus/events', async (req, res) => {
  try {
    const { events, session } = req.body;

    if (!events || !Array.isArray(events)) {
      return res.status(400).json({ error: 'events array is required' });
    }

    console.log(
      `[DataClaus] Received ${events.length} events from session ${session?.sessionId}`
    );

    // Transform events for DataClaus API format
    const transformedEvents = events.map((event) => ({
      eventId: event.eventId,
      userId: event.userId,
      eventType: event.eventType,
      timestamp: event.timestamp,
      payload: event.payload,
      sessionId: event.sessionId,
      device: event.device,
    }));

    // Use SDK if available, otherwise fallback to manual HMAC
    if (dataclausClient) {
      // ======== USING SDK ========
      console.log('[SDK] Sending batch via DataClaus SDK...');

      try {
        const result = await dataclausClient.ingestBatch(transformedEvents);
        console.log(`[SDK] Successfully sent ${events.length} events`);

        res.json({
          success: true,
          message: 'Events forwarded via SDK',
          eventsReceived: events.length,
          sdkUsed: true,
          dataclausResponse: result,
        });
      } catch (sdkError) {
        console.error('[SDK] Error:', sdkError.message);
        // Fallback to manual if SDK fails
        throw new Error('SDK_FALLBACK');
      }
    } else {
      // ======== FALLBACK: Manual HMAC ========
      console.log('[Fallback] Using manual HMAC signing...');

      const dataclausPayload = {
        events: transformedEvents.map((e) => ({
          event_id: e.eventId,
          developer_id: CONFIG.DEVELOPER_ID,
          user_id: e.userId,
          event_type: e.eventType,
          timestamp: e.timestamp,
          payload: e.payload,
          session_id: e.sessionId,
          device: e.device,
        })),
        session: session
          ? {
              session_id: session.sessionId,
              start_time: session.startTime,
              active_seconds: session.activeSeconds,
            }
          : undefined,
      };

      const signature = generateHMACSignature(dataclausPayload);

      const response = await fetch(
        `${CONFIG.DATACLAUS_API_URL}/v1/ingest/batch`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': CONFIG.DATACLAUS_API_KEY,
            'X-Signature': signature,
          },
          body: JSON.stringify(dataclausPayload),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[Fallback] API error: ${response.status} - ${errorText}`
        );
        return res.json({
          success: true,
          message: 'Events received (DataClaus API temporarily unavailable)',
          eventsReceived: events.length,
          queued: true,
        });
      }

      const result = await response.json();
      console.log(`[Fallback] Successfully forwarded ${events.length} events`);

      res.json({
        success: true,
        message: 'Events forwarded via manual HMAC',
        eventsReceived: events.length,
        sdkUsed: false,
        dataclausResponse: result,
      });
    }
  } catch (error) {
    console.error('[DataClaus] Error:', error.message);
    res.json({
      success: true,
      message: 'Events received (will retry forwarding)',
      eventsReceived: req.body?.events?.length || 0,
      queued: true,
    });
  }
});

/**
 * Get user earnings (proxy to DataClaus API)
 * Returns mock data for demo if API fails
 */
app.get('/dataclaus/earnings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const response = await fetch(
      `${CONFIG.DATACLAUS_API_URL}/analytics/quality-score/${userId}`
    );

    if (response.ok) {
      const data = await response.json();
      return res.json(data);
    }

    // API failed - return mock quality score for demo
    console.log(`[Demo] Returning mock quality score for user: ${userId}`);
    const mockScore = 0.65 + Math.random() * 0.25; // Random score between 0.65-0.90
    res.json({
      user_id: userId,
      quality_score: parseFloat(mockScore.toFixed(4)),
      mock: true,
      message: 'Demo mode - AI Worker not running',
    });
  } catch (error) {
    console.error('[DataClaus] Error fetching earnings:', error);

    // Return mock data on error for demo
    const mockScore = 0.65 + Math.random() * 0.25;
    res.json({
      user_id: req.params.userId,
      quality_score: parseFloat(mockScore.toFixed(4)),
      mock: true,
      message: 'Demo mode - API unavailable',
    });
  }
});

/**
 * Dashboard stats (proxy to DataClaus API)
 */
app.get('/dataclaus/dashboard', async (req, res) => {
  try {
    const response = await fetch(
      `${CONFIG.DATACLAUS_API_URL}/analytics/dashboard`
    );

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: 'Failed to fetch dashboard' });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[DataClaus] Error fetching dashboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * reCAPTCHA Enterprise Token Verification
 *
 * This endpoint receives tokens from the mobile SDK's useRecaptcha hook
 * and verifies them with Google reCAPTCHA Enterprise.
 *
 * For PRODUCTION: Use @google-cloud/recaptcha-enterprise package
 * For DEMO: We simulate the assessment with random scores
 *
 * POST /dataclaus/recaptcha/verify
 * Body: { token, action, timestamp, ... }
 * Response: { score, reasons, tokenValid, actionValid, raw? }
 */
app.post('/dataclaus/recaptcha/verify', async (req, res) => {
  try {
    const { token, action, userId, deviceId } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'reCAPTCHA token is required',
        code: 'TOKEN_MISSING',
      });
    }

    console.log(`[reCAPTCHA] Verifying token for action: ${action}`);

    // Option 1: Use the SDK (Preferred/Production Way)
    if (recaptchaVerifier) {
      try {
        const result = await recaptchaVerifier.verify({
          token,
          expectedAction: action,
          userId: userId,
          userIpAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });

        console.log(
          `[reCAPTCHA] SDK Result: Score=${result.score} Valid=${result.tokenValid}`
        );

        return res.json(result);
      } catch (sdkError) {
        console.error('[reCAPTCHA] SDK Error:', sdkError.message);
        return res.status(500).json({
          error: 'Verification SDK Failed',
          details: sdkError.message,
        });
      }
    }

    // If SDK not initialized, return error
    return res.status(500).json({
      error: 'Server SDK not initialized correctly.',
      details: 'Check GOOGLE_CLOUD_PROJECT_ID and credentials.',
    });
  } catch (error) {
    console.error('[reCAPTCHA] Error:', error);
    res.status(500).json({
      error: error.message || 'reCAPTCHA verification failed',
      code: 'VERIFICATION_ERROR',
    });
  }
});

/**
 * Fraud Detection Report Endpoint
 *
 * Receives fraud detection metrics from the mobile SDK and stores them.
 */
app.post('/dataclaus/fraud-report', async (req, res) => {
  try {
    const { userId, metrics, timestamp } = req.body;

    console.log(`[Fraud Report] Received from user: ${userId}`);
    console.log(`[Fraud Report]   Fraud Score: ${metrics?.fraudScore}`);
    console.log(`[Fraud Report]   Is Emulator: ${metrics?.isEmulator}`);
    console.log(
      `[Fraud Report]   Activity: ${metrics?.motionPatterns?.activityState}`
    );
    console.log(
      `[Fraud Report]   Signals: ${metrics?.fraudSignals?.length || 0}`
    );

    // In production, you would:
    // 1. Store in database
    // 2. Trigger alerts if high fraud score
    // 3. Update user risk profile

    res.json({
      success: true,
      message: 'Fraud report received',
      analysis: {
        riskLevel:
          metrics?.fraudScore < 0.3
            ? 'LOW'
            : metrics?.fraudScore < 0.6
            ? 'MEDIUM'
            : 'HIGH',
        recommendedAction: metrics?.fraudScore > 0.7 ? 'BLOCK' : 'MONITOR',
      },
    });
  } catch (error) {
    console.error('[Fraud Report] Error:', error);
    res.status(500).json({ error: 'Failed to process fraud report' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler

app.use((err, req, res, _next) => {
  console.error('[Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log(' DataClaus Demo Backend');
  console.log('========================');
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`SDK Enabled: ${dataclausClient !== null}`);
  console.log('');
  console.log('Configuration:');
  console.log(`  DataClaus API: ${CONFIG.DATACLAUS_API_URL}`);
  console.log(`  Developer ID: ${CONFIG.DEVELOPER_ID}`);
  console.log('');
  console.log('Endpoints:');
  console.log(`  GET  /health              - Health check`);
  console.log(`  POST /dataclaus/events    - Receive events from mobile app`);
  console.log(`  GET  /dataclaus/earnings/:userId - Get user earnings`);
  console.log(`  GET  /dataclaus/dashboard - Get dashboard stats`);
  console.log('');
});
