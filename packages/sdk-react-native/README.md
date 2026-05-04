# @dataclaus/sdk-react-native

> React Native SDK for DataClaus - Monetize your app with fair revenue sharing.

[![npm version](https://badge.fury.io/js/@dataclaus%2Fsdk-react-native.svg)](https://www.npmjs.com/package/@dataclaus/sdk-react-native)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

DataClaus enables developers to share advertising revenue with their users. This SDK provides:

- **User Identity Linking** - Connect your users to DataClaus accounts for earnings tracking
- **Ad Revenue Components** - Banner, interstitial, and rewarded ads with automatic revenue sharing
- **Earnings Display** - Show users how much they've earned in real-time
- **Fraud Detection** - AI-powered bot detection to ensure payouts go to real humans

## Installation

```bash
npm install @dataclaus/sdk-react-native
# or
yarn add @dataclaus/sdk-react-native
```

### Peer Dependencies

```bash
npm install react react-native
```

### Optional Dependencies

For enhanced device fingerprinting:
```bash
npm install react-native-device-info
```

For sensor data collection:
```bash
npm install expo-sensors
```

## Quick Start

### 1. Link Users

After user authentication, link them to DataClaus:

```tsx
import { useIdentity } from '@dataclaus/sdk-react-native';

function AfterLogin({ user }) {
  const { linkUser, isLinked, earnings } = useIdentity({
    apiUrl: 'https://api.dataclaus.io',
    applicationId: 'YOUR_APP_ID',
  });

  useEffect(() => {
    linkUser({
      externalUserId: user.id,
      email: user.email, // Optional, helps cross-app matching
    });
  }, [user]);

  return (
    <View>
      {isLinked && (
        <Text>You've earned ${earnings?.totalEarned ?? 0}</Text>
      )}
    </View>
  );
}
```

### 2. Display Ads

Wrap your app with `AdProvider` and display ads:

```tsx
import { AdProvider, BannerAd, useRewardedAd } from '@dataclaus/sdk-react-native';

// In your app root
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
}

// In your screens
function HomeScreen() {
  const { isLoaded, load, show } = useRewardedAd({
    onRewarded: (reward) => {
      // Give user in-app currency
      addCoins(reward.amount);
    },
    onPaidEvent: (impression) => {
      console.log(`Ad earned $${impression.revenue}`);
    },
  });

  useEffect(() => { load(); }, []);

  return (
    <SafeAreaView>
      {/* Banner at bottom of screen */}
      <BannerAd size="banner" />
      
      {/* Rewarded ad button */}
      <TouchableOpacity 
        onPress={show} 
        disabled={!isLoaded}
      >
        <Text>Watch Ad for Cash</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
```

## API Reference

### User Identity

#### `useIdentity(config)`

React hook for user identity management.

```ts
interface UserIdentityConfig {
  apiUrl: string;           // DataClaus API URL
  applicationId: string;    // Your app ID from dashboard
  debug?: boolean;          // Enable console logging
}

interface UseIdentityResult {
  linkedUser: LinkedUser | null;
  linkUser: (request: LinkUserRequest) => Promise<LinkedUser>;
  earnings: UserEarnings | null;
  refreshEarnings: () => Promise<void>;
  isLoading: boolean;
  isLinked: boolean;
  logout: () => void;
  error: string | null;
}
```

#### `linkUser(request)`

Links an external user to DataClaus.

```ts
interface LinkUserRequest {
  externalUserId: string;    // Your user ID
  email?: string;            // Optional email for cross-app matching
  phone?: string;            // Optional phone for matching
}

interface LinkedUser {
  dataclausUserId: string;
  userToken: string;         // Use for ad requests
  isNewUser: boolean;
  walletId: string;
}
```

### Ads

#### `AdProvider`

Context provider for ads.

```tsx
<AdProvider config={{
  apiUrl: string;
  applicationId: string;
  userToken: string;
  testMode?: boolean;      // Default: true
  debug?: boolean;
}}>
  {children}
</AdProvider>
```

#### `BannerAd`

Display a banner advertisement.

```tsx
<BannerAd
  size="banner" | "largeBanner" | "mediumRectangle" | "adaptive"
  onAdLoaded={() => {}}
  onAdError={(error) => {}}
  onPaidEvent={(impression) => {}}
  style={ViewStyle}
/>
```

#### `useInterstitialAd()`

Hook for full-screen interstitial ads.

```ts
const { isLoaded, isLoading, load, show, error } = useInterstitialAd();

// Load when screen mounts
useEffect(() => { load(); }, []);

// Show at natural break point
const handleLevelComplete = () => {
  if (isLoaded) show();
};
```

#### `useRewardedAd(options)`

Hook for rewarded ads where users watch for rewards.

```ts
const { isLoaded, load, show, reward } = useRewardedAd({
  onRewarded: (reward) => {
    console.log(`User earned ${reward.amount} ${reward.type}`);
  },
  onPaidEvent: (impression) => {
    console.log(`Ad revenue: $${impression.revenue}`);
  },
});
```

### Fraud Detection

#### `useFraudDetection(config)`

Monitor for bot/emulator signals.

```ts
const { fraudScore, isBot, signals } = useFraudDetection({
  sensitivityLevel: 'medium',
});

if (isBot) {
  // Don't send data - won't earn rewards anyway
}
```

## Revenue Distribution

When ads are shown, revenue is split automatically:

| Recipient | Share | Example ($10 CPM) |
|-----------|-------|-------------------|
| User | 50-90% (configurable) | $7.00 |
| Developer | 5-45% | $2.50 |
| Platform | 5% (fixed) | $0.50 |

Configure your app's revenue share in the DataClaus dashboard.

## Best Practices

### 1. Always Link Users First

Ads won't track properly without a linked user:

```tsx
// ❌ Bad - ads won't attribute revenue
<AdProvider userToken="">
  <BannerAd />
</AdProvider>

// ✅ Good - wait for user linking
{linkedUser && (
  <AdProvider userToken={linkedUser.userToken}>
    <BannerAd />
  </AdProvider>
)}
```

### 2. Use Test Mode in Development

```tsx
<AdProvider config={{
  ...config,
  testMode: __DEV__, // Uses test ads and simulated revenue
}}>
```

### 3. Handle Offline Gracefully

```tsx
const { error } = useIdentity(config);

if (error) {
  // Still let users use the app
  return <OfflineMode />;
}
```

### 4. Preload Rewarded Ads

```tsx
// Load immediately when screen mounts
useEffect(() => { 
  load(); 
}, []);

// Reload after showing
const handlePress = async () => {
  await show();
  load(); // Preload next ad
};
```

## TypeScript Support

This package includes TypeScript definitions. All exports are fully typed.

```ts
import type { 
  LinkedUser, 
  UserEarnings, 
  AdImpression, 
  AdType 
} from '@dataclaus/sdk-react-native';
```

## Troubleshooting

### "Ads not enabled for this application"

1. Check your `applicationId` is correct
2. Ensure ads are enabled in the dashboard
3. Verify your app is approved for production ads

### "Failed to link user"

1. Check network connectivity
2. Verify `apiUrl` points to correct server
3. Check application ID matches dashboard

### Low Quality Score

Users with scores below 0.5 don't earn rewards:
- Encourage natural app usage
- Don't incentivize fake engagement
- Our AI detects automated patterns

## Support

- **Documentation:** [docs.dataclaus.io](https://docs.dataclaus.io)
- **Dashboard:** [dashboard.dataclaus.io](https://dashboard.dataclaus.io)
- **Discord:** [discord.gg/dataclaus](https://discord.gg/dataclaus)
- **Email:** support@dataclaus.io

## License

MIT © DataClaus
