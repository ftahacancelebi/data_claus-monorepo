# @dataclaus/sdk-node

> Node.js SDK for DataClaus - Server-side ad impression recording and revenue tracking.

[![npm version](https://badge.fury.io/js/@dataclaus%2Fsdk-node.svg)](https://www.npmjs.com/package/@dataclaus/sdk-node)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

The DataClaus Node.js SDK is designed for your backend server to securely communicate with the DataClaus API. Use it to:

- **Record Ad Impressions** - Track ad views and automatically distribute revenue
- **Manage Users** - Verify user tokens and fetch earnings data
- **Get Revenue Reports** - Access detailed revenue summaries for your apps
- **HMAC Authentication** - Secure all API requests with cryptographic signatures

## Installation

```bash
npm install @dataclaus/sdk-node
# or
yarn add @dataclaus/sdk-node
```

## Quick Start

### Initialize the SDK

```typescript
import { DataClausAuth } from '@dataclaus/sdk-node';

const auth = new DataClausAuth({
  apiUrl: process.env.DATACLAUS_API_URL || 'http://localhost:3002',
  apiKey: process.env.DATACLAUS_API_KEY,
});
```

### Record Ad Impression

When your mobile app displays an ad and reports back to your server:

```typescript
app.post('/api/ads/impression', async (req, res) => {
  const { userId, adType, revenue } = req.body;
  
  const result = await auth.recordAdImpression(
    process.env.DATACLAUS_APP_ID,
    userId,
    adType, // 'banner' | 'interstitial' | 'rewarded'
    revenue,
    {
      sessionId: req.body.sessionId,
      countryCode: req.body.country,
    }
  );

  res.json({
    success: true,
    impressionId: result.impressionId,
    userEarned: result.userShare,
    devEarned: result.devShare,
  });
});
```

### Get User Earnings

```typescript
app.get('/api/users/:userId/earnings', async (req, res) => {
  const earnings = await auth.getUserEarnings(req.params.userId);
  
  res.json({
    total: earnings.totalEarned,
    available: earnings.availableBalance,
    pending: earnings.pendingBalance,
    qualityScore: earnings.qualityScore,
  });
});
```

### Get Ad Rates

```typescript
const rates = await auth.getAdRates();

console.log('Banner eCPM:', rates.banner.ecpm);
console.log('Interstitial eCPM:', rates.interstitial.ecpm);
console.log('Rewarded eCPM:', rates.rewarded.ecpm);
```

### Get Revenue Summary

```typescript
const summary = await auth.getAppRevenueSummary(
  process.env.DATACLAUS_APP_ID,
  'month' // 'today' | 'week' | 'month' | 'year' | 'all'
);

console.log('Total impressions:', summary.totalImpressions);
console.log('Gross revenue:', summary.totalGrossRevenue);
console.log('Your share:', summary.totalDevShare);
console.log('Average eCPM:', summary.averageEcpm);
```

## API Reference

### `DataClausAuth`

The main authentication client class.

```typescript
const auth = new DataClausAuth({
  apiUrl?: string;  // Default: http://localhost:3002
  apiKey?: string;  // Required for authenticated endpoints
});
```

### Methods

#### `recordAdImpression(appId, userId, adType, grossRevenue?, options?)`

Records an ad impression and distributes revenue.

```typescript
const result = await auth.recordAdImpression(
  'app_123',
  'user_456',
  'rewarded',
  0.015, // optional gross revenue
  {
    adUnitId: 'ad_unit_789',
    sessionId: 'session_abc',
    deviceInfo: 'iPhone 14',
    countryCode: 'US',
  }
);

// Result:
// {
//   impressionId: 'imp_...',
//   grossRevenue: 0.015,
//   userShare: 0.0105,    // 70%
//   devShare: 0.00375,    // 25%
//   platformFee: 0.00075, // 5%
//   userNewTotal: 1.234,
//   distributed: true,
// }
```

#### `getUserEarnings(userId)`

Fetches a user's earnings summary.

```typescript
const earnings = await auth.getUserEarnings('user_456');

// Result:
// {
//   totalEarned: 12.50,
//   pendingBalance: 0.003,
//   availableBalance: 12.497,
//   qualityScore: 0.95,
// }
```

#### `getAdRates()`

Gets current eCPM rates for all ad types.

```typescript
const rates = await auth.getAdRates();

// Result:
// {
//   banner: { ecpm: 1.0, perImpression: 0.001 },
//   interstitial: { ecpm: 3.0, perImpression: 0.003 },
//   rewarded: { ecpm: 15.0, perImpression: 0.015 },
//   currency: 'USD',
//   platformFeePercent: 5,
//   defaultUserShare: 70,
// }
```

#### `getAdConfig(appId)`

Gets ad configuration for an application.

```typescript
const config = await auth.getAdConfig('app_123');

// Result:
// {
//   applicationId: 'app_123',
//   userSharePercent: 70,
//   devSharePercent: 25,
//   platformPercent: 5,
//   enabledAdTypes: ['banner', 'interstitial', 'rewarded'],
//   minimumEcpm: 0.5,
// }
```

#### `getAppRevenueSummary(appId, period?)`

Gets revenue summary for an application.

```typescript
const summary = await auth.getAppRevenueSummary('app_123', 'month');

// Result:
// {
//   totalImpressions: 15000,
//   totalGrossRevenue: 150.00,
//   totalUserShare: 105.00,
//   totalDevShare: 37.50,
//   totalPlatformFee: 7.50,
//   averageEcpm: 10.00,
//   bannerImpressions: 10000,
//   interstitialCount: 3000,
//   rewardedCount: 2000,
// }
```

#### `getUserRevenueSummary(userId, period?)`

Gets revenue summary for a specific user.

#### `getDevRevenueSummary(developerId, period?)`

Gets revenue summary for a developer across all apps.

## Data Ingestion (Optional)

For sensor data collection (advanced use case):

```typescript
import DataClausClient from '@dataclaus/sdk-node';

const client = new DataClausClient({
  apiKey: process.env.DATACLAUS_API_KEY,
  developerId: process.env.DATACLAUS_DEVELOPER_ID,
});

await client.ingest({
  userId: 'user_123',
  eventType: 'session',
  timestamp: new Date().toISOString(),
  payload: {
    session: {
      startTime: '2024-01-01T10:00:00Z',
      activeSeconds: 3600,
      screenViews: 15,
    },
  },
});
```

## Environment Variables

```bash
DATACLAUS_API_URL=http://localhost:3002
DATACLAUS_API_KEY=your_api_key
DATACLAUS_APP_ID=your_application_id
DATACLAUS_DEVELOPER_ID=your_developer_id
```

## TypeScript Support

This package includes TypeScript definitions. All exports are fully typed.

```typescript
import type {
  DataClausAuthConfig,
  AdImpressionResult,
  UserEarnings,
  AdRates,
  AdConfig,
  AdRevenueSummary,
} from '@dataclaus/sdk-node';
```

## Security Best Practices

1. **Never expose API keys in client-side code** - Always proxy requests through your backend
2. **Use environment variables** - Store API keys securely
3. **Validate user tokens** - Always verify user identity before recording impressions
4. **Use HTTPS in production** - Encrypt all API communications

## Support

- **Documentation:** [docs.dataclaus.io](https://docs.dataclaus.io)
- **Dashboard:** [dashboard.dataclaus.io](https://dashboard.dataclaus.io)
- **Email:** support@dataclaus.io

## License

MIT © DataClaus
