# DataClaus Platform Documentation

## Overview

DataClaus is a data monetization platform that enables **fair revenue sharing** between developers, users, and data buyers. Unlike traditional advertising where users generate value but receive nothing, DataClaus ensures users earn money for their genuine engagement.

## Core Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DataClaus Architecture                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│    ┌──────────────┐                         ┌──────────────────┐        │
│    │  Mobile App  │                         │   Dashboard      │        │
│    │  (RN SDK)    │                         │   (Next.js)      │        │
│    └──────┬───────┘                         └────────┬─────────┘        │
│           │                                          │                   │
│           ▼                                          │                   │
│    ┌──────────────┐                                  │                   │
│    │  Developer   │                                  │                   │
│    │  Backend     │◄─────────────────────────────────┘                   │
│    │  (Node SDK)  │                                                      │
│    └──────┬───────┘                                                      │
│           │ HMAC Signed                                                  │
│           ▼                                                              │
│    ┌─────────────────────────────────────────────────────────┐          │
│    │                  DataClaus API (Go)                      │          │
│    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │          │
│    │  │ Identity │  │   Ads    │  │ Wallets  │  │ Analytics│ │          │
│    │  │ Service  │  │ Service  │  │ Service  │  │ Service  │ │          │
│    │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │          │
│    └──────────────────────┬──────────────────────────────────┘          │
│                           │                                              │
│           ┌───────────────┼───────────────┐                              │
│           ▼               ▼               ▼                              │
│    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                   │
│    │    Kafka     │ │  PostgreSQL  │ │  AI Worker   │                   │
│    │  (Events)    │ │  (Storage)   │ │  (Scoring)   │                   │
│    └──────────────┘ └──────────────┘ └──────────────┘                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Features

### 1. User Identity Linking

Connect your app's users to DataClaus accounts for accurate earnings tracking.

**Why is this needed?**
- Users may use multiple apps with different user IDs
- Earnings need to be consolidated into one wallet
- Device fingerprinting helps match users across apps

**Flow:**
1. User logs into your app → You call `linkUser(externalId, email)`
2. DataClaus checks for existing matches (email, device fingerprint)
3. Creates or returns existing DataClaus user ID
4. Returns a short-lived token for authenticated requests
5. All sensor data and ad revenue is now linked to this user

**SDK Usage:**
```typescript
import { useIdentity } from '@dataclaus/sdk-react-native';

const { linkUser, earnings } = useIdentity({
  apiUrl: 'https://api.dataclaus.io',
  applicationId: 'YOUR_APP_ID',
});

await linkUser({
  externalUserId: user.id,
  email: user.email, // Optional but helps matching
});
```

### 2. Ad Revenue Sharing

Display ads and automatically share revenue with users.

**Supported Ad Types:**

| Type | CPM Range | Use Case |
|------|-----------|----------|
| Banner | $0.50-2 | Persistent display at top/bottom |
| Interstitial | $1-5 | Natural break points (level complete) |
| Rewarded | $5-20 | User opts in for in-app reward |

**Why through DataClaus?**

Direct AdMob integration means:
- Developer gets 100% of revenue
- Users get nothing
- No verification of fair splitting

DataClaus as intermediary:
- Ad requests flow through our servers
- Revenue is reported by AdMob to us
- We split and credit wallets automatically
- Fully auditable and transparent

**SDK Usage:**
```tsx
import { AdProvider, BannerAd, useRewardedAd } from '@dataclaus/sdk-react-native';

<AdProvider config={{
  apiUrl: 'https://api.dataclaus.io',
  applicationId: 'YOUR_APP_ID',
  userToken: linkedUser.userToken,
  testMode: __DEV__,
}}>
  <BannerAd size="banner" />
</AdProvider>
```

### 3. Revenue Configuration

Configure how revenue is distributed for each application.

**Fixed Values:**
- Platform Fee: **5%** (non-negotiable)
- Minimum Payout Threshold: **$0.01**

**Configurable Values:**
- User Share: **50-90%** (you choose)
- Developer Share: **5-45%** (100 - 5 - user share)

**Example Configurations:**

| App Type | User | Developer | Platform | Rationale |
|----------|------|-----------|----------|-----------|
| Gaming | 80% | 15% | 5% | High user share drives engagement |
| Productivity | 60% | 35% | 5% | Users already get app value |
| Social | 70% | 25% | 5% | Balanced approach |

### 4. Fraud Detection & Quality Scoring

Our AI system analyzes user behavior to detect bots and ensure payouts go to real humans.

**Signals Analyzed:**
- Accelerometer jitter patterns (bots have unnatural consistency)
- Touch pressure and timing variance
- Gyroscope movement patterns
- Session timing and active time
- Device fingerprint consistency
- Emulator detection signals

**Quality Score (0-1):**

| Score | Classification | Action |
|-------|---------------|--------|
| 0.9-1.0 | Verified Human | Full payout |
| 0.7-0.9 | Likely Human | Full payout |
| 0.5-0.7 | Suspicious | Reduced payout |
| 0.0-0.5 | Bot/Fraud | No payout |

### 5. Webhook Integration

Receive real-time notifications when events occur.

**Event Types:**
- `user.earnings.updated` - User earned money
- `user.quality.changed` - Quality score updated
- `payout.completed` - Withdrawal processed
- `ad.revenue.recorded` - Ad impression tracked
- `campaign.matched` - Data matched to buyer

**Setup:**
1. Generate webhook secret in dashboard
2. Configure your endpoint URL
3. Verify signatures on incoming requests

**Verification:**
```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return signature === expected;
}
```

## API Endpoints

### Applications

| Method | Path | Description |
|--------|------|-------------|
| POST | `/developers/:id/applications` | Create application |
| GET | `/developers/:id/applications` | List applications |
| GET | `/applications/:id` | Get application details |
| PUT | `/applications/:id` | Update application |
| PATCH | `/applications/:id/status` | Toggle active status |

**Create Application Request:**
```json
{
  "name": "My Fitness App",
  "description": "Track workouts and earn",
  "category": "Health & Fitness",
  "user_share_percent": 70
}
```

### User Identity

| Method | Path | Description |
|--------|------|-------------|
| POST | `/applications/:id/users/link` | Link external user |
| GET | `/applications/:id/users/external/:externalId` | Get by external ID |
| GET | `/users/:id/earnings` | Get user earnings |

**Link User Request:**
```json
{
  "external_user_id": "user_12345",
  "email": "user@example.com",
  "device_fingerprint": "abc123..."
}
```

**Link User Response:**
```json
{
  "dataclaus_user_id": "uuid",
  "user_token": "jwt-token",
  "is_new_user": false,
  "wallet_id": "uuid"
}
```

### Ad Revenue

| Method | Path | Description |
|--------|------|-------------|
| GET | `/applications/:id/ads/config` | Get ad configuration |
| POST | `/applications/:id/ads/impression` | Record impression |
| GET | `/applications/:id/ads/summary` | Get revenue summary |

### Webhooks

| Method | Path | Description |
|--------|------|-------------|
| POST | `/developers/:id/webhook-secret` | Generate secret |
| GET | `/developers/:id/webhook-secrets` | List secrets |
| DELETE | `/developers/:id/webhook-secrets/:secretId` | Revoke secret |

## Data Flow

### User Earns from Ad

```
1. User sees ad in app
   │
2. SDK calls: POST /applications/:id/ads/impression
   │    └─ Includes: user_token, ad_type, revenue
   │
3. API validates user token
   │
4. API records impression in database
   │
5. Revenue split calculated:
   │    ├─ User: $0.007 (70%)
   │    ├─ Developer: $0.002.5 (25%)
   │    └─ Platform: $0.0005 (5%)
   │
6. Wallets credited (pending if < $0.01)
   │
7. Webhook sent: user.earnings.updated
   │
8. User sees updated balance in real-time
```

### Sensor Data Collection

```
1. SDK collects sensor data (accelerometer, gyroscope)
   │
2. Batched and sent to developer backend
   │
3. Developer backend forwards to DataClaus with HMAC
   │    └─ POST /v1/ingest
   │
4. Data pushed to Kafka
   │
5. AI Worker consumes from Kafka
   │    └─ Runs fraud detection model
   │
6. Quality score calculated
   │
7. If quality > 0.5 and campaign matched:
   │    └─ Revenue distributed
   │
8. ScoredEvent stored for analytics
```

## Security

### HMAC Authentication

All `/v1/ingest` endpoints require HMAC-SHA256 signatures.

**Headers:**
- `X-DataClaus-Timestamp`: Unix milliseconds
- `X-DataClaus-Signature`: HMAC signature
- `X-DataClaus-App-Id`: Application ID

**Signature Generation:**
```javascript
const signature = crypto
  .createHmac('sha256', API_KEY)
  .update(timestamp + 'POST' + path + body)
  .digest('hex');
```

### User Tokens

User tokens are short-lived JWTs (24 hours) for ad requests.

**Contains:**
- `sub`: DataClaus user ID
- `app`: Application ID
- `exp`: Expiration timestamp
- `iat`: Issued at timestamp

## Best Practices

### 1. Always Link Before Ads

```typescript
// ❌ Don't show ads without linking
<AdProvider userToken="">
  <BannerAd />
</AdProvider>

// ✅ Wait for user to be linked
{linkedUser && (
  <AdProvider userToken={linkedUser.userToken}>
    <BannerAd />
  </AdProvider>
)}
```

### 2. Use Test Mode

```typescript
// During development
testMode: __DEV__

// In production
testMode: false
```

### 3. Handle Errors Gracefully

```typescript
const { error } = useIdentity(config);

// Don't block the app if DataClaus is unavailable
if (error) {
  console.warn('DataClaus unavailable:', error);
  // App still works, just no earnings
}
```

### 4. Respect User Privacy

- Only collect data when user consents
- Provide clear disclosure about data usage
- Allow users to opt out

## Troubleshooting

### "Invalid signature"

1. Check API key is correct
2. Verify timestamp is within 5 minutes
3. Ensure body is identical when signing and sending

### "User not found"

1. Call `linkUser` before accessing user data
2. Check token hasn't expired (24 hours)
3. Verify application ID matches

### Low Quality Scores

1. Ensure natural app usage patterns
2. Don't incentivize fake engagement
3. Check for emulator detection

## Support

- **Dashboard:** https://dashboard.dataclaus.io
- **API Status:** https://status.dataclaus.io
- **Discord:** https://discord.gg/dataclaus
- **Email:** support@dataclaus.io

---

*Last updated: December 2024*
