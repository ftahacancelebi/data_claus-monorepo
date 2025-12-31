'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { 
    Code,
    Copy,
    CheckCircle,
    DeviceMobile,
    Globe,
    Terminal,
    ArrowRight,
    ArrowLeft,
    Book,
    Lightning,
    Rocket,
    Key,
    ShieldCheck,
    Database,
    ChartBar,
    Warning,
    Info,
    Users,
    CurrencyDollar,
    Wallet,
    UserCircle,
    VideoCamera,
    Link,
    Lock,
    Play,
    X,
    CaretRight,
    FileCode,
    Cube
} from 'phosphor-react';

// ============================================================
// Types
// ============================================================

interface DocSection {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  shortDesc: string;
  content: DocContent;
}

interface DocContent {
  overview: string[];
  keyFeatures: { title: string; description: string }[];
  types: TypeDefinition[];
  examples: CodeExample[];
}

interface TypeDefinition {
  name: string;
  description: string;
  properties: { name: string; type: string; description: string; required?: boolean }[];
}

interface CodeExample {
  title: string;
  description: string;
  code: string;
  language: 'typescript' | 'javascript' | 'bash';
}

// ============================================================
// SDK Data
// ============================================================

const sdks = [
  {
    name: 'React Native SDK',
    description: 'Full-featured SDK for iOS and Android with identity linking and ads.',
    icon: DeviceMobile,
    version: '2.0.0',
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    install: 'npm install @dataclaus/sdk-react-native',
    features: ['User Identity', 'Ads Revenue', 'Sensor Data', 'Fraud Detection'],
  },
  {
    name: 'Node.js SDK',
    description: 'Server-side SDK for HMAC signing and secure data forwarding.',
    icon: Terminal,
    version: '2.0.1',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-50',
    install: 'npm install @dataclaus/sdk-node',
    features: ['HMAC Auth', 'Data Ingestion', 'reCAPTCHA', 'Webhooks'],
  },
  {
    name: 'Web SDK',
    description: 'Lightweight SDK for browser-based applications.',
    icon: Globe,
    version: '1.0.0',
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
    install: 'npm install @dataclaus/sdk-web',
    features: ['Session Tracking', 'Events', 'Analytics'],
  },
];

// ============================================================
// Documentation Content
// ============================================================

const docSections: DocSection[] = [
  {
    id: 'overview',
    title: 'Platform Overview',
    icon: Book,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    shortDesc: 'Learn what DataClaus is and how it works',
    content: {
      overview: [
        'DataClaus is a data monetization platform that enables fair revenue sharing between developers, users, and data buyers.',
        'Unlike traditional advertising where users generate value but receive nothing, DataClaus ensures users earn money for their genuine engagement.',
        'Our AI-powered quality scoring system detects bots and ensures only real humans are rewarded.',
      ],
      keyFeatures: [
        { title: 'Fair Revenue Sharing', description: 'Users earn 50-90% of the revenue they generate, configurable per app.' },
        { title: 'Fraud Protection', description: 'AI-powered bot detection ensures payouts go to real humans only.' },
        { title: 'Simple Integration', description: 'Drop-in SDKs for React Native, Node.js, and Web applications.' },
        { title: 'Real-time Analytics', description: 'Track events, quality scores, and revenue in your dashboard.' },
      ],
      types: [],
      examples: [],
    },
  },
  {
    id: 'identity',
    title: 'User Identity',
    icon: UserCircle,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    shortDesc: 'Link app users to DataClaus accounts for earnings',
    content: {
      overview: [
        'The identity system connects your app\'s users to DataClaus accounts for accurate revenue attribution.',
        'When a user logs into your app, call linkUser() to create or find their DataClaus account.',
        'Device fingerprinting enables cross-app user matching even before they create an account.',
      ],
      keyFeatures: [
        { title: 'External ID Linking', description: 'Map your user IDs to DataClaus accounts seamlessly.' },
        { title: 'Cross-App Matching', description: 'Same user across multiple apps gets consolidated earnings.' },
        { title: 'Device Fingerprinting', description: 'Match users by device even before email verification.' },
        { title: 'Short-lived Tokens', description: 'Secure 24-hour tokens for authenticated requests.' },
      ],
      types: [
        {
          name: 'LinkUserRequest',
          description: 'Request payload for linking an external user to DataClaus.',
          properties: [
            { name: 'externalUserId', type: 'string', description: 'Your internal user ID', required: true },
            { name: 'email', type: 'string', description: 'User email for cross-app matching' },
            { name: 'phone', type: 'string', description: 'User phone for matching' },
            { name: 'deviceFingerprint', type: 'string', description: 'Auto-generated device identifier' },
          ],
        },
        {
          name: 'LinkedUser',
          description: 'Response after successfully linking a user.',
          properties: [
            { name: 'dataclausUserId', type: 'string', description: 'DataClaus internal user ID', required: true },
            { name: 'userToken', type: 'string', description: 'JWT token for API requests (24h validity)', required: true },
            { name: 'isNewUser', type: 'boolean', description: 'Whether this is a newly created user', required: true },
            { name: 'walletId', type: 'string', description: 'User\'s wallet ID for earnings', required: true },
          ],
        },
        {
          name: 'UserEarnings',
          description: 'User\'s earnings summary.',
          properties: [
            { name: 'totalEarned', type: 'number', description: 'Total amount earned across all apps', required: true },
            { name: 'pendingBalance', type: 'number', description: 'Balance below $0.01 threshold', required: true },
            { name: 'availableBalance', type: 'number', description: 'Available for withdrawal', required: true },
            { name: 'qualityScore', type: 'number', description: 'User quality score (0-1)', required: true },
            { name: 'currency', type: 'string', description: 'Currency code (USD)', required: true },
          ],
        },
      ],
      examples: [
        {
          title: 'Basic User Linking',
          description: 'Link a user after they authenticate in your app.',
          language: 'typescript',
          code: `import { useIdentity } from '@dataclaus/sdk-react-native';

function AfterLogin({ user }) {
  const { linkUser, isLinked, earnings } = useIdentity({
    apiUrl: 'https://api.dataclaus.io',
    applicationId: 'YOUR_APP_ID',
  });

  useEffect(() => {
    linkUser({
      externalUserId: user.id,
      email: user.email,
    });
  }, [user]);

  if (isLinked) {
    return <Text>You've earned \${earnings?.totalEarned ?? 0}</Text>;
  }
  return <ActivityIndicator />;
}`,
        },
        {
          title: 'Manual Identity Management',
          description: 'For more control, use the UserIdentityManager class directly.',
          language: 'typescript',
          code: `import { UserIdentityManager } from '@dataclaus/sdk-react-native';

const manager = new UserIdentityManager({
  apiUrl: 'https://api.dataclaus.io',
  applicationId: 'YOUR_APP_ID',
  debug: true,
});

// Link user
const linkedUser = await manager.linkUser({
  externalUserId: 'user_12345',
  email: 'user@example.com',
});

// Get earnings
const earnings = await manager.getEarnings();
console.log('Total earned:', earnings?.totalEarned);

// Logout
manager.logout();`,
        },
      ],
    },
  },
  {
    id: 'ads',
    title: 'Ad Revenue',
    icon: VideoCamera,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    shortDesc: 'Display ads and share revenue with users',
    content: {
      overview: [
        'Display ads in your app and automatically share revenue with users based on your configured split.',
        'Revenue flows through DataClaus to ensure verifiable, fair distribution that users can trust.',
        'Support for banner, interstitial, and rewarded ad formats with automatic impression tracking.',
      ],
      keyFeatures: [
        { title: 'Banner Ads', description: 'Standard display ads with $0.50-2 CPM. Great for passive revenue.' },
        { title: 'Interstitial Ads', description: 'Full-screen ads with $1-5 CPM. Show at natural break points.' },
        { title: 'Rewarded Ads', description: 'User-initiated for $5-20 CPM. Highest engagement and revenue.' },
        { title: 'Automatic Splitting', description: 'Revenue automatically distributed to user, developer, and platform.' },
      ],
      types: [
        {
          name: 'AdConfig',
          description: 'Configuration for initializing the ad system.',
          properties: [
            { name: 'apiUrl', type: 'string', description: 'DataClaus API URL', required: true },
            { name: 'applicationId', type: 'string', description: 'Your application ID', required: true },
            { name: 'userToken', type: 'string', description: 'Token from user linking', required: true },
            { name: 'testMode', type: 'boolean', description: 'Use test ads (default: true)' },
            { name: 'debug', type: 'boolean', description: 'Enable console logging' },
          ],
        },
        {
          name: 'AdImpression',
          description: 'Recorded when an ad generates revenue.',
          properties: [
            { name: 'impressionId', type: 'string', description: 'Unique impression identifier', required: true },
            { name: 'adType', type: 'AdType', description: 'banner | interstitial | rewarded', required: true },
            { name: 'adUnitId', type: 'string', description: 'Ad unit that was displayed', required: true },
            { name: 'revenue', type: 'number', description: 'Revenue generated in USD', required: true },
            { name: 'currency', type: 'string', description: 'Currency code', required: true },
            { name: 'timestamp', type: 'string', description: 'ISO timestamp', required: true },
          ],
        },
        {
          name: 'AdReward',
          description: 'Reward given to user after watching rewarded ad.',
          properties: [
            { name: 'type', type: 'string', description: 'Reward type (e.g., "coins")', required: true },
            { name: 'amount', type: 'number', description: 'Reward amount', required: true },
          ],
        },
      ],
      examples: [
        {
          title: 'Setup AdProvider',
          description: 'Wrap your app with AdProvider to enable ads.',
          language: 'typescript',
          code: `import { AdProvider } from '@dataclaus/sdk-react-native';

function App() {
  const { linkedUser } = useIdentity({ ... });
  
  if (!linkedUser) return <LoginScreen />;
  
  return (
    <AdProvider config={{
      apiUrl: 'https://api.dataclaus.io',
      applicationId: 'YOUR_APP_ID',
      userToken: linkedUser.userToken,
      testMode: __DEV__,
    }}>
      <Navigation />
    </AdProvider>
  );
}`,
        },
        {
          title: 'Banner Ad',
          description: 'Display a banner advertisement.',
          language: 'typescript',
          code: `import { BannerAd } from '@dataclaus/sdk-react-native';

function HomeScreen() {
  return (
    <View style={{ flex: 1 }}>
      <ScrollView>
        {/* Your content */}
      </ScrollView>
      
      {/* Banner at bottom */}
      <BannerAd
        size="banner"
        onAdLoaded={() => console.log('Ad loaded')}
        onPaidEvent={(impression) => {
          console.log(\`Earned: \$\${impression.revenue}\`);
        }}
      />
    </View>
  );
}`,
        },
        {
          title: 'Rewarded Ad',
          description: 'Let users watch ads for in-app rewards.',
          language: 'typescript',
          code: `import { useRewardedAd } from '@dataclaus/sdk-react-native';

function RewardButton() {
  const { isLoaded, load, show, reward } = useRewardedAd({
    onRewarded: (reward) => {
      // Give user their reward
      addCoins(reward.amount);
      showToast(\`You earned \${reward.amount} coins!\`);
    },
    onPaidEvent: (impression) => {
      analytics.track('ad_revenue', { amount: impression.revenue });
    },
  });

  useEffect(() => { load(); }, []);

  return (
    <TouchableOpacity
      onPress={async () => {
        await show();
        load(); // Preload next ad
      }}
      disabled={!isLoaded}
      style={[styles.button, !isLoaded && styles.disabled]}
    >
      <VideoCamera size={20} />
      <Text>Watch Ad for 50 Coins</Text>
    </TouchableOpacity>
  );
}`,
        },
      ],
    },
  },
  {
    id: 'revenue',
    title: 'Revenue Config',
    icon: CurrencyDollar,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    shortDesc: 'Configure revenue distribution per app',
    content: {
      overview: [
        'Each application can have its own revenue share configuration, allowing you to optimize for different use cases.',
        'The platform fee is fixed at 5%, while you can configure user share between 50-90%.',
        'Higher user shares attract more engaged users, while lower shares maximize your revenue.',
      ],
      keyFeatures: [
        { title: 'Per-App Settings', description: 'Different apps can have different revenue configurations.' },
        { title: 'Real-time Updates', description: 'Changes take effect immediately for new impressions.' },
        { title: 'Transparent Breakdown', description: 'Users can see exactly how revenue is split.' },
        { title: 'Minimum Threshold', description: 'Earnings below $0.01 accumulate until threshold is reached.' },
      ],
      types: [
        {
          name: 'RevenueShareConfig',
          description: 'Revenue distribution configuration.',
          properties: [
            { name: 'userSharePercent', type: 'number', description: 'User share (50-90%)', required: true },
            { name: 'developerSharePercent', type: 'number', description: 'Calculated: 100 - 5 - userShare', required: true },
            { name: 'platformFeePercent', type: 'number', description: 'Fixed at 5%', required: true },
            { name: 'minPayoutThreshold', type: 'number', description: 'Minimum $0.01', required: true },
          ],
        },
      ],
      examples: [
        {
          title: 'Get Revenue Configuration',
          description: 'Fetch current revenue share settings.',
          language: 'typescript',
          code: `import { getRevenueShares } from '@/lib/api';

const config = await getRevenueShares();
console.log('User share:', config.user_share_percent + '%');
console.log('Developer share:', config.developer_share_percent + '%');
console.log('Platform fee:', config.platform_fee_percent + '%');`,
        },
        {
          title: 'Update App Revenue Share',
          description: 'Configure revenue split for an application.',
          language: 'typescript',
          code: `import { updateApplication } from '@/lib/api';

await updateApplication(appId, {
  user_share_percent: 75, // Give users 75%
  // Developer gets 20% (100 - 5 - 75)
  // Platform gets 5%
});`,
        },
      ],
    },
  },
  {
    id: 'authentication',
    title: 'Authentication',
    icon: Lock,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    shortDesc: 'Secure your API requests with HMAC',
    content: {
      overview: [
        'All data ingestion endpoints require HMAC-SHA256 signatures for authentication.',
        'Never expose your API keys in client-side code. Mobile apps should send data through your backend.',
        'The signature includes timestamp, method, path, and body to prevent replay attacks.',
      ],
      keyFeatures: [
        { title: 'HMAC-SHA256', description: 'Industry-standard cryptographic signing.' },
        { title: 'Replay Protection', description: 'Timestamps prevent request replay attacks.' },
        { title: 'Server-side Signing', description: 'SDKs handle signing automatically.' },
        { title: 'Key Rotation', description: 'Generate new keys and revoke old ones instantly.' },
      ],
      types: [
        {
          name: 'AuthHeaders',
          description: 'Required headers for authenticated requests.',
          properties: [
            { name: 'X-DataClaus-Timestamp', type: 'string', description: 'Unix milliseconds', required: true },
            { name: 'X-DataClaus-Signature', type: 'string', description: 'HMAC-SHA256 signature', required: true },
            { name: 'X-DataClaus-App-Id', type: 'string', description: 'Application ID', required: true },
          ],
        },
      ],
      examples: [
        {
          title: 'Generate Signature',
          description: 'Create HMAC signature for API requests.',
          language: 'typescript',
          code: `import crypto from 'crypto';

function signRequest(
  method: string,
  path: string,
  body: string,
  apiKey: string
): { timestamp: string; signature: string } {
  const timestamp = Date.now().toString();
  const payload = timestamp + method + path + body;
  
  const signature = crypto
    .createHmac('sha256', apiKey)
    .update(payload)
    .digest('hex');
  
  return { timestamp, signature };
}

// Usage
const { timestamp, signature } = signRequest(
  'POST',
  '/v1/ingest',
  JSON.stringify(data),
  process.env.DATACLAUS_API_KEY
);`,
        },
        {
          title: 'Node.js SDK (Automatic)',
          description: 'The SDK handles signing automatically.',
          language: 'typescript',
          code: `import { DataClausClient } from '@dataclaus/sdk-node';

const client = new DataClausClient({
  apiKey: process.env.DATACLAUS_API_KEY,
  apiSecret: process.env.DATACLAUS_SECRET,
});

// All requests are automatically signed
await client.ingest({
  event_type: 'purchase',
  user_id: 'user_123',
  payload: { amount: 99.99 },
});`,
        },
      ],
    },
  },
  {
    id: 'webhooks',
    title: 'Webhooks',
    icon: Link,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    shortDesc: 'Receive real-time event notifications',
    content: {
      overview: [
        'Webhooks notify your server in real-time when important events occur.',
        'All webhooks include an HMAC signature for verification.',
        'Failed deliveries are retried 3 times with exponential backoff.',
      ],
      keyFeatures: [
        { title: 'Real-time Delivery', description: 'Events sent within seconds of occurring.' },
        { title: 'Signature Verification', description: 'HMAC signatures prevent tampering.' },
        { title: 'Automatic Retries', description: '3 retries with exponential backoff.' },
        { title: 'Event Filtering', description: 'Subscribe only to events you care about.' },
      ],
      types: [
        {
          name: 'WebhookPayload',
          description: 'Structure of incoming webhook requests.',
          properties: [
            { name: 'event_type', type: 'WebhookEventType', description: 'Type of event', required: true },
            { name: 'timestamp', type: 'string', description: 'ISO timestamp', required: true },
            { name: 'data', type: 'object', description: 'Event-specific data', required: true },
            { name: 'signature', type: 'string', description: 'HMAC signature (in header)', required: true },
          ],
        },
        {
          name: 'WebhookEventType',
          description: 'Available webhook event types.',
          properties: [
            { name: 'user.earnings.updated', type: 'event', description: 'User earned money', required: false },
            { name: 'user.quality.changed', type: 'event', description: 'Quality score updated', required: false },
            { name: 'payout.completed', type: 'event', description: 'Withdrawal processed', required: false },
            { name: 'ad.revenue.recorded', type: 'event', description: 'Ad impression tracked', required: false },
            { name: 'campaign.matched', type: 'event', description: 'Data matched to buyer', required: false },
          ],
        },
      ],
      examples: [
        {
          title: 'Verify Webhook Signature',
          description: 'Always verify webhook signatures before processing.',
          language: 'typescript',
          code: `import crypto from 'crypto';

const WEBHOOK_SECRET = process.env.DATACLAUS_WEBHOOK_SECRET;

function verifyWebhook(payload: string, signature: string): boolean {
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

app.post('/webhooks/dataclaus', (req, res) => {
  const signature = req.headers['x-dataclaus-signature'];
  const payload = JSON.stringify(req.body);
  
  if (!verifyWebhook(payload, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process webhook...
  res.json({ received: true });
});`,
        },
        {
          title: 'Handle Webhook Events',
          description: 'Process different event types.',
          language: 'typescript',
          code: `app.post('/webhooks/dataclaus', (req, res) => {
  const { event_type, data } = req.body;
  
  switch (event_type) {
    case 'user.earnings.updated':
      console.log(\`User \${data.user_id} earned \$\${data.amount}\`);
      // Update your UI or notify user
      break;
      
    case 'payout.completed':
      console.log(\`Payout \${data.payout_id} completed\`);
      // Send confirmation email
      break;
      
    case 'ad.revenue.recorded':
      analytics.track('ad_revenue', {
        impression_id: data.impression_id,
        revenue: data.revenue,
      });
      break;
  }
  
  res.json({ received: true });
});`,
        },
      ],
    },
  },
  {
    id: 'fraud',
    title: 'Fraud Detection',
    icon: ShieldCheck,
    color: 'text-teal-600',
    bgColor: 'bg-teal-100',
    shortDesc: 'AI-powered bot detection and quality scoring',
    content: {
      overview: [
        'Our AI system analyzes behavioral patterns to distinguish real humans from bots.',
        'Users with low quality scores receive reduced or no payouts, protecting the ecosystem.',
        'The system continuously learns and adapts to new fraud patterns.',
      ],
      keyFeatures: [
        { title: 'Sensor Analysis', description: 'Accelerometer and gyroscope patterns reveal bot behavior.' },
        { title: 'Touch Patterns', description: 'Pressure, timing, and location analyzed for authenticity.' },
        { title: 'Emulator Detection', description: 'Identifies virtual devices and automated tools.' },
        { title: 'Quality Scoring', description: 'Real-time 0-1 score for each user.' },
      ],
      types: [
        {
          name: 'QualityScore',
          description: 'User quality assessment.',
          properties: [
            { name: 'score', type: 'number', description: 'Quality score from 0 to 1', required: true },
            { name: 'classification', type: 'string', description: 'verified_human | likely_human | suspicious | bot', required: true },
            { name: 'signals', type: 'FraudSignal[]', description: 'Contributing fraud signals' },
          ],
        },
        {
          name: 'FraudSignal',
          description: 'Individual fraud detection signal.',
          properties: [
            { name: 'type', type: 'string', description: 'Signal type (e.g., "emulator_detected")', required: true },
            { name: 'confidence', type: 'number', description: 'Confidence level 0-1', required: true },
            { name: 'details', type: 'string', description: 'Human-readable explanation' },
          ],
        },
      ],
      examples: [
        {
          title: 'Check User Quality',
          description: 'Get quality score for a user.',
          language: 'typescript',
          code: `import { getUserQualityScore } from '@/lib/api';

const result = await getUserQualityScore(userId);

if (result.quality_score >= 0.7) {
  console.log('Verified human - full payout eligible');
} else if (result.quality_score >= 0.5) {
  console.log('Suspicious - reduced payout');
} else {
  console.log('Likely bot - no payout');
}`,
        },
        {
          title: 'React Native Fraud Detection',
          description: 'Monitor for fraud signals in your app.',
          language: 'typescript',
          code: `import { useFraudDetection } from '@dataclaus/sdk-react-native';

function App() {
  const { fraudScore, isBot, signals } = useFraudDetection({
    sensitivityLevel: 'medium',
  });

  if (isBot) {
    // Don't collect data - won't earn anyway
    console.warn('Bot detected:', signals);
    return null;
  }

  return <DataCollection fraudScore={fraudScore} />;
}`,
        },
      ],
    },
  },
  {
    id: 'analytics',
    title: 'Analytics',
    icon: ChartBar,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
    shortDesc: 'Track events, revenue, and performance',
    content: {
      overview: [
        'Real-time analytics for all events processed through DataClaus.',
        'Track revenue, user quality, and engagement metrics from your dashboard or API.',
        'Aggregated statistics help you optimize your revenue strategy.',
      ],
      keyFeatures: [
        { title: 'Real-time Events', description: 'See events as they flow through the system.' },
        { title: 'Revenue Tracking', description: 'Track earnings by app, user, and time period.' },
        { title: 'Quality Metrics', description: 'Monitor average quality scores and trends.' },
        { title: 'API Access', description: 'Fetch analytics data programmatically.' },
      ],
      types: [
        {
          name: 'DashboardStats',
          description: 'Aggregated dashboard statistics.',
          properties: [
            { name: 'total_events', type: 'number', description: 'Total events processed', required: true },
            { name: 'total_users', type: 'number', description: 'Unique users', required: true },
            { name: 'total_developers', type: 'number', description: 'Registered developers', required: true },
            { name: 'average_quality', type: 'number', description: 'Average quality score', required: true },
            { name: 'total_payouts', type: 'number', description: 'Total revenue distributed', required: true },
            { name: 'active_campaigns', type: 'number', description: 'Active buyer campaigns', required: true },
          ],
        },
        {
          name: 'ApplicationStats',
          description: 'Per-application statistics.',
          properties: [
            { name: 'application_id', type: 'string', description: 'Application ID', required: true },
            { name: 'total_events', type: 'number', description: 'Events for this app', required: true },
            { name: 'total_users', type: 'number', description: 'Unique users', required: true },
            { name: 'total_revenue', type: 'number', description: 'Revenue generated', required: true },
            { name: 'avg_quality', type: 'number', description: 'Average quality score', required: true },
            { name: 'events_today', type: 'number', description: 'Events in last 24h', required: true },
          ],
        },
      ],
      examples: [
        {
          title: 'Fetch Dashboard Stats',
          description: 'Get overview statistics.',
          language: 'typescript',
          code: `import { getDashboard } from '@/lib/api';

const stats = await getDashboard();

console.log('Total events:', stats.total_events);
console.log('Total payouts:', stats.total_payouts);
console.log('Avg quality:', (stats.average_quality * 100).toFixed(1) + '%');`,
        },
        {
          title: 'Get App Statistics',
          description: 'Fetch statistics for a specific application.',
          language: 'typescript',
          code: `import { getApplicationStats } from '@/lib/api';

const stats = await getApplicationStats(appId);

console.log('App revenue:', stats.total_revenue);
console.log('Unique users:', stats.total_users);
console.log('Events today:', stats.events_today);`,
        },
      ],
    },
  },
];

// ============================================================
// Helper Components
// ============================================================

function HighlightedCode({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  
  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <Button
        variant="ghost"
        size="sm"
        onClick={copyCode}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-white hover:bg-slate-700 z-10"
      >
        {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
      </Button>
      <pre className="bg-slate-900 text-slate-300 p-4 rounded-xl text-sm overflow-x-auto font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function TypeCard({ type }: { type: TypeDefinition }) {
  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Cube size={18} className="text-blue-500" weight="duotone" />
          <CardTitle className="text-base font-mono text-slate-800">{type.name}</CardTitle>
        </div>
        <p className="text-sm text-slate-500">{type.description}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium text-slate-600">Property</th>
                <th className="text-left p-3 font-medium text-slate-600">Type</th>
                <th className="text-left p-3 font-medium text-slate-600">Description</th>
              </tr>
            </thead>
            <tbody>
              {type.properties.map((prop, i) => (
                <tr key={prop.name} className={i % 2 === 1 ? 'bg-slate-50/50' : ''}>
                  <td className="p-3 font-mono text-slate-800">
                    {prop.name}
                    {prop.required && <span className="text-red-500 ml-1">*</span>}
                  </td>
                  <td className="p-3 font-mono text-blue-600">{prop.type}</td>
                  <td className="p-3 text-slate-600">{prop.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
      <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <CheckCircle size={14} className="text-emerald-600" weight="fill" />
      </div>
      <div>
        <h4 className="font-semibold text-slate-800">{title}</h4>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function DocsPage() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  if (!user) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const currentSection = docSections.find(s => s.id === activeSection);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <AnimatePresence mode="wait">
        {activeSection && currentSection ? (
          // ==================== DETAIL VIEW ====================
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            {/* Back Button + Header */}
            <div>
              <Button
                variant="ghost"
                onClick={() => setActiveSection(null)}
                className="mb-4 text-slate-600 hover:text-slate-900 -ml-2"
              >
                <ArrowLeft size={18} className="mr-2" />
                Back to Documentation
              </Button>
              
              <div className="flex items-center gap-4">
                <div className={`h-14 w-14 rounded-2xl ${currentSection.bgColor} flex items-center justify-center`}>
                  <currentSection.icon size={28} className={currentSection.color} weight="duotone" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">{currentSection.title}</h1>
                  <p className="text-slate-500">{currentSection.shortDesc}</p>
                </div>
              </div>
            </div>

            {/* Overview */}
            <Card className="glass-panel border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <Book size={20} weight="duotone" />
                  Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentSection.content.overview.map((para, i) => (
                  <p key={i} className="text-slate-600 leading-relaxed">{para}</p>
                ))}
                
                {currentSection.content.keyFeatures.length > 0 && (
                  <div className="grid md:grid-cols-2 gap-4 mt-6">
                    {currentSection.content.keyFeatures.map((feature, i) => (
                      <FeatureCard key={i} title={feature.title} description={feature.description} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Type Definitions */}
            {currentSection.content.types.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <FileCode size={22} weight="duotone" />
                  Type Definitions
                </h2>
                <div className="grid gap-4">
                  {currentSection.content.types.map((type, i) => (
                    <TypeCard key={i} type={type} />
                  ))}
                </div>
              </div>
            )}

            {/* Code Examples */}
            {currentSection.content.examples.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Code size={22} weight="duotone" />
                  Code Examples
                </h2>
                <div className="grid gap-6">
                  {currentSection.content.examples.map((example, i) => (
                    <Card key={i} className="border border-slate-200 bg-white overflow-hidden">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base text-slate-800">{example.title}</CardTitle>
                        <p className="text-sm text-slate-500">{example.description}</p>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <HighlightedCode code={example.code} language={example.language} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          // ==================== LIST VIEW ====================
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            {/* Header */}
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">SDK Documentation</h1>
              <p className="text-slate-500 mt-1">
                Everything you need to integrate DataClaus and start earning.
              </p>
            </div>

            {/* Quick Start Banner */}
            <Card className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border-0 overflow-hidden">
              <CardContent className="p-6 relative">
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute top-[-50%] right-[-20%] w-[60%] h-[200%] bg-blue-500/10 rotate-12"></div>
                </div>
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                      <Rocket size={28} weight="duotone" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Quick Start Guide</h2>
                      <p className="text-slate-300">Get up and running in 3 simple steps</p>
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">1</div>
                      <span>Link Users</span>
                    </div>
                    <ArrowRight className="text-slate-600" />
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">2</div>
                      <span>Add Ads</span>
                    </div>
                    <ArrowRight className="text-slate-600" />
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">3</div>
                      <span>Earn Revenue</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Documentation Categories */}
            <div>
              <h2 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Book size={20} weight="duotone" />
                Documentation
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {docSections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <motion.div
                      key={section.id}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Card 
                        className="cursor-pointer hover:shadow-lg transition-all border border-slate-200 h-full"
                        onClick={() => setActiveSection(section.id)}
                      >
                        <CardContent className="p-5">
                          <div className={`h-11 w-11 rounded-xl ${section.bgColor} flex items-center justify-center mb-3`}>
                            <Icon size={22} className={section.color} weight="duotone" />
                          </div>
                          <h3 className="font-semibold text-slate-900 mb-1">{section.title}</h3>
                          <p className="text-sm text-slate-500 mb-3">{section.shortDesc}</p>
                          <div className="flex items-center text-sm font-medium text-blue-600">
                            View Documentation
                            <CaretRight size={14} className="ml-1" />
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* SDK Cards */}
            <div>
              <h2 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Terminal size={20} weight="duotone" />
                SDK Installation
              </h2>
              <div className="grid gap-4 md:grid-cols-3">
                {sdks.map((sdk, index) => (
                  <motion.div
                    key={sdk.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="glass-panel border-0 shadow-lg hover:shadow-xl transition-all h-full">
                      <CardContent className="p-6">
                        <div className={`h-12 w-12 rounded-xl ${sdk.bgColor} flex items-center justify-center mb-4`}>
                          <sdk.icon size={24} className={sdk.color} weight="duotone" />
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold text-slate-900">{sdk.name}</h3>
                          <Badge variant="outline" className="text-[10px]">v{sdk.version}</Badge>
                        </div>
                        <p className="text-sm text-slate-500 mb-4">{sdk.description}</p>
                        
                        {/* Features */}
                        <div className="flex flex-wrap gap-1 mb-4">
                          {sdk.features.map(f => (
                            <Badge key={f} className="text-[10px] bg-slate-100 text-slate-600 border-0">{f}</Badge>
                          ))}
                        </div>
                        
                        <div className="bg-slate-900 rounded-lg p-3 flex items-center justify-between">
                          <code className="text-xs text-slate-300 font-mono truncate pr-2">{sdk.install}</code>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
                            onClick={() => copyToClipboard(sdk.install, sdk.name)}
                          >
                            {copied === sdk.name ? <CheckCircle size={14} /> : <Copy size={14} />}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Important Notes */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="bg-amber-50/80 border-amber-200/50 backdrop-blur-sm">
                <CardContent className="p-5 flex gap-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Warning size={20} className="text-amber-600" weight="duotone" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-amber-800 mb-1">API Key Security</h4>
                    <p className="text-sm text-amber-700">Never expose API keys in client-side code. Send data through your backend.</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-blue-50/80 border-blue-200/50 backdrop-blur-sm">
                <CardContent className="p-5 flex gap-4">
                  <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Info size={20} className="text-blue-600" weight="duotone" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-blue-800 mb-1">Test Mode</h4>
                    <p className="text-sm text-blue-700">Use <code className="bg-blue-100 px-1 rounded">testMode: true</code> during development.</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Integration Steps */}
            <div>
              <h3 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Play size={20} weight="duotone" />
                Step-by-Step Integration
              </h3>
              <div className="grid gap-4 md:grid-cols-4">
                {[
                  { num: 1, title: 'Create Application', desc: 'Register your app and configure revenue share.', color: 'emerald' },
                  { num: 2, title: 'Install SDKs', desc: 'Add React Native SDK to mobile, Node SDK to backend.', color: 'blue' },
                  { num: 3, title: 'Link Users', desc: 'Call linkUser after authentication.', color: 'purple' },
                  { num: 4, title: 'Add Ads & Earn', desc: 'Integrate ad components and start generating revenue.', color: 'orange' },
                ].map((step) => (
                  <Card key={step.num} className="glass-panel border-0 shadow-lg">
                    <CardContent className="p-5">
                      <div className={`h-10 w-10 rounded-full bg-${step.color}-100 text-${step.color}-600 flex items-center justify-center font-bold text-lg mb-3`}>
                        {step.num}
                      </div>
                      <h3 className="font-bold text-slate-900 mb-1">{step.title}</h3>
                      <p className="text-sm text-slate-500">{step.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
