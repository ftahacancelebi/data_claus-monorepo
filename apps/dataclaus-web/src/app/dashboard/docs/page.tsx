'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { Highlight, themes } from 'prism-react-renderer';
import {
  Code,
  Copy,
  CheckCircle,
  DeviceMobile,
  Terminal,
  ArrowRight,
  Book,
  Rocket,
  Warning,
  Info,
  CaretRight,
  Cube,
  CurrencyDollar,
  Users,
  VideoCamera,
  ShieldCheck,
  Lock,
  Lightning,
  Fingerprint,
  Plug,
  MagnifyingGlass,
  ChartLineUp,
  Cpu,
  Bug,
  Lifebuoy,
  Key,
  Heartbeat,
  Robot,
  GearSix,
  StackSimple,
  Globe,
  Bell,
  ShareNetwork,
  HandPalm,
  CloudArrowUp,
  ListChecks,
  X,
  List as ListIcon,
} from 'phosphor-react';

// ============================================================
// Types
// ============================================================

type Lang = 'typescript' | 'javascript' | 'bash' | 'tsx' | 'json' | 'sql';

interface CodeExample {
  title: string;
  description?: string;
  language: Lang;
  code: string;
  filename?: string;
  highlight?: 'good' | 'bad';
}

interface DocBlock {
  kind: 'paragraph' | 'callout' | 'code' | 'heading' | 'list' | 'table' | 'diagram' | 'apiref';
  text?: string;
  variant?: 'info' | 'warning' | 'success' | 'danger';
  title?: string;
  level?: 2 | 3 | 4;
  examples?: CodeExample[];
  items?: string[];
  columns?: string[];
  rows?: string[][];
  diagram?: { steps: { num: number; title: string; desc: string }[] };
  apiref?: ApiRef;
}

interface ApiRef {
  signature: string;
  params?: { name: string; type: string; required?: boolean; description: string }[];
  returns?: string;
  throws?: string;
}

interface DocSection {
  id: string;
  title: string;
  icon: React.ElementType;
  badge?: string;
  description: string;
  blocks: DocBlock[];
}

interface DocCategory {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
  sections: DocSection[];
}

// ============================================================
// Documentation Content
// ============================================================

const docs: DocCategory[] = [
  // ════════════════════════════════════════════════════════════
  // Getting Started
  // ════════════════════════════════════════════════════════════
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: Rocket,
    color: 'text-blue-500',
    sections: [
      {
        id: 'overview',
        title: 'Overview',
        icon: Book,
        description: 'A 60-second tour of the DataClaus platform.',
        blocks: [
          {
            kind: 'paragraph',
            text: 'DataClaus turns the behavioral signals your users already produce — sensor patterns, ad impressions, session activity — into transparent, real-time payouts. This SDK is the bridge between your mobile app and the DataClaus revenue engine.',
          },
          {
            kind: 'heading',
            level: 3,
            text: 'What you get out of the box',
          },
          {
            kind: 'list',
            items: [
              'Bypass-resistant ad revenue flow (slot/seal cycle, server-authoritative).',
              'User identity linking with cross-app device fingerprinting.',
              'On-device fraud detection: emulator, bot, throttle, and pattern signals.',
              'reCAPTCHA Enterprise + Apple App Attest / Play Integrity hooks.',
              'Server-side HMAC-signed ingest for sensor data.',
              'Realtime earnings + quality score updates over WebSocket.',
            ],
          },
          {
            kind: 'callout',
            variant: 'info',
            title: 'Architecture in one sentence',
            text: 'Mobile App → DataClaus SDK (RN) → Your Backend (Node SDK + HMAC) → DataClaus Core (NestJS) → Postgres ledger + Kafka events.',
          },
        ],
      },
      {
        id: 'quickstart',
        title: 'Quick start (10 min)',
        icon: Lightning,
        badge: 'Start here',
        description: 'Boot a working integration end-to-end in ten minutes.',
        blocks: [
          {
            kind: 'diagram',
            diagram: {
              steps: [
                { num: 1, title: 'Create app', desc: 'Register your app in the dashboard, copy the App ID.' },
                { num: 2, title: 'Install SDKs', desc: 'pnpm add the React Native + Node packages.' },
                { num: 3, title: 'Wire auth', desc: 'OTP login → identity link → user token.' },
                { num: 4, title: 'Show an ad', desc: 'requestSlot → render → sealImpression.' },
              ],
            },
          },
          {
            kind: 'code',
            examples: [
              {
                title: '1. Install the SDKs',
                description: 'Mobile + server packages. The server one is optional but recommended for production.',
                language: 'bash',
                code: `# Mobile (React Native / Expo)
pnpm add @dataclaus/sdk-react-native

# Optional but recommended:
pnpm add react-native-device-info expo-crypto expo-sensors

# Server-side (Node / NestJS / Express)
pnpm add @dataclaus/sdk-node`,
              },
              {
                title: '2. Configure environment',
                description: 'Pull these from the dashboard. NEVER hardcode the API key — only the App ID is safe to ship to the client.',
                language: 'bash',
                filename: '.env',
                code: `# Safe in client bundle:
DATACLAUS_API_URL=https://api.dataclaus.io
DATACLAUS_APP_ID=app_xxxxxxxxxxxxxxxxxxxxxxxx

# SERVER-ONLY — never ship to the client:
DATACLAUS_API_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxx
DATACLAUS_DEVELOPER_ID=dev_xxxxxxxxxxxxxxxxxxxxxxxx
DATACLAUS_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx`,
              },
              {
                title: '3. Wrap your app',
                description: 'Two providers, in this exact order: auth → ads. Identity linking happens after login inside your component tree.',
                language: 'tsx',
                filename: 'App.tsx',
                code: `import {
  DataClausAuthProvider,
  AdProvider,
  useDataClausAuth,
  useIdentity,
} from '@dataclaus/sdk-react-native';

function Inner() {
  const { user, accessToken } = useDataClausAuth();
  const { linkedUser, linkUser } = useIdentity({
    apiUrl: process.env.EXPO_PUBLIC_DATACLAUS_API_URL!,
    applicationId: process.env.EXPO_PUBLIC_DATACLAUS_APP_ID!,
  });

  if (!user) return <LoginScreen />;
  if (!linkedUser) {
    void linkUser({ externalUserId: user.id, email: user.email });
    return <Splash />;
  }

  return (
    <AdProvider config={{
      apiUrl: process.env.EXPO_PUBLIC_DATACLAUS_API_URL!,
      applicationId: process.env.EXPO_PUBLIC_DATACLAUS_APP_ID!,
      userId: linkedUser.dataclausUserId,
      userToken: linkedUser.userToken,
      testMode: __DEV__,
    }}>
      <RootNavigator />
    </AdProvider>
  );
}

export default function App() {
  return (
    <DataClausAuthProvider config={{
      apiUrl: process.env.EXPO_PUBLIC_DATACLAUS_API_URL!,
      applicationId: process.env.EXPO_PUBLIC_DATACLAUS_APP_ID!,
    }}>
      <Inner />
    </DataClausAuthProvider>
  );
}`,
              },
            ],
          },
          {
            kind: 'callout',
            variant: 'success',
            title: 'You\'re ready',
            text: 'Drop a <BannerAd /> anywhere inside <AdProvider> and you\'re live. Revenue is split automatically per the percentages you configured for the app.',
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════
  // Authentication
  // ════════════════════════════════════════════════════════════
  {
    id: 'auth',
    title: 'Authentication',
    icon: Key,
    color: 'text-indigo-500',
    sections: [
      {
        id: 'auth-flow',
        title: 'Auth flow (OTP)',
        icon: Lock,
        description: 'Email-based one-time passwords. No passwords stored on device.',
        blocks: [
          {
            kind: 'paragraph',
            text: 'DataClaus uses passwordless OTP login. Users enter an email; we email a 6-digit code; verifying the code returns an access token + refresh token. Tokens are stored via expo-secure-store on device.',
          },
          {
            kind: 'diagram',
            diagram: {
              steps: [
                { num: 1, title: 'requestOTP(email)', desc: 'POST /auth/request-otp — server emails 6-digit code.' },
                { num: 2, title: 'verifyOTP(code)', desc: 'POST /auth/verify-otp — returns accessToken + user.' },
                { num: 3, title: 'Token persisted', desc: 'AccessToken auto-refreshed; logout clears storage.' },
              ],
            },
          },
          {
            kind: 'code',
            examples: [
              {
                title: 'useDataClausAuth — full login screen',
                description: 'Drop-in screen that handles request → verify → resend with cooldown.',
                language: 'tsx',
                filename: 'screens/Login.tsx',
                code: `import { useState } from 'react';
import { useDataClausAuth } from '@dataclaus/sdk-react-native';

export function LoginScreen() {
  const {
    requestOTP, verifyOTP,
    isAuthenticating, error,
  } = useDataClausAuth();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');

  const handleRequest = async () => {
    const r = await requestOTP({ email });
    if (r.success) setStep('code');
  };

  const handleVerify = async () => {
    const r = await verifyOTP({ email, code });
    if (r.success) console.log('Logged in:', r.user);
  };

  return step === 'email' ? (
    <View>
      <TextInput
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Button title="Send code" onPress={handleRequest}
        disabled={isAuthenticating} />
      {error && <Text>{error}</Text>}
    </View>
  ) : (
    <View>
      <TextInput value={code} onChangeText={setCode}
        keyboardType="number-pad" maxLength={6} />
      <Button title="Verify" onPress={handleVerify}
        disabled={code.length !== 6 || isAuthenticating} />
    </View>
  );
}`,
              },
              {
                title: 'Reading the current user anywhere',
                language: 'tsx',
                code: `import { useDataClausAuth } from '@dataclaus/sdk-react-native';

function Header() {
  const { user, logout } = useDataClausAuth();

  if (!user) return null;
  return (
    <View>
      <Text>Hello, {user.email}</Text>
      <TouchableOpacity onPress={logout}>
        <Text>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}`,
              },
            ],
          },
          {
            kind: 'callout',
            variant: 'warning',
            title: 'OTP delivery in development',
            text: 'In dev mode the OTP is also logged to the API server stdout. In production we go through SES / SendGrid — set DATACLAUS_SMTP_* env vars.',
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════
  // User Identity Linking
  // ════════════════════════════════════════════════════════════
  {
    id: 'identity',
    title: 'User Identity Linking',
    icon: Fingerprint,
    color: 'text-purple-500',
    sections: [
      {
        id: 'identity-overview',
        title: 'Why link users',
        icon: ShareNetwork,
        description: 'Connect your app\'s user records to a DataClaus wallet so impressions credit the right person across apps.',
        blocks: [
          {
            kind: 'paragraph',
            text: 'A single human can use ten different apps that ship with the DataClaus SDK. Without identity linking they would each get their own walled-off wallet. linkUser() collapses them into a single wallet keyed by (email | phone | device fingerprint).',
          },
          {
            kind: 'list',
            items: [
              'Same device, two apps → same DataClaus wallet (when fingerprints overlap).',
              'Different devices, same email → still the same wallet.',
              'New device, no signal → new wallet, can be merged later via verified email.',
            ],
          },
          {
            kind: 'code',
            examples: [
              {
                title: 'Link after your existing login',
                description: 'Call linkUser() once — the SDK persists the resulting userToken (24h TTL, auto-refreshed).',
                language: 'tsx',
                code: `import { useEffect } from 'react';
import { useIdentity } from '@dataclaus/sdk-react-native';

function PostLogin({ appUser }: { appUser: { id: string; email: string } }) {
  const {
    linkUser, isLinked, linkedUser,
    earnings, isLoadingEarnings, refreshEarnings,
  } = useIdentity({
    apiUrl: process.env.EXPO_PUBLIC_DATACLAUS_API_URL!,
    applicationId: process.env.EXPO_PUBLIC_DATACLAUS_APP_ID!,
  });

  useEffect(() => {
    if (!isLinked) {
      linkUser({
        externalUserId: appUser.id,
        email: appUser.email,
      });
    }
  }, [appUser.id, isLinked]);

  if (!isLinked) return <ActivityIndicator />;

  return (
    <View>
      <Text>DataClaus ID: {linkedUser!.dataclausUserId}</Text>
      <Text>You have earned: \${earnings?.totalEarned?.toFixed(2) ?? '0.00'}</Text>
      <Text>Quality score: {(earnings?.qualityScore ?? 0).toFixed(2)}</Text>
      <Button title="Refresh" onPress={refreshEarnings} />
    </View>
  );
}`,
              },
            ],
          },
          {
            kind: 'apiref',
            title: 'linkUser(payload)',
            apiref: {
              signature: 'linkUser(payload: LinkUserRequest): Promise<LinkedUser>',
              params: [
                { name: 'externalUserId', type: 'string', required: true, description: 'Your internal user ID. Stable across logins.' },
                { name: 'email', type: 'string', description: 'Optional. Used for cross-app matching when fingerprints don\'t overlap.' },
                { name: 'phone', type: 'string', description: 'Optional. E.164 format preferred.' },
              ],
              returns: '{ dataclausUserId, userToken, isNewUser, walletId, tokenExpiresAt }',
              throws: 'Network error or 4xx if the App ID does not exist / is suspended.',
            },
          },
          {
            kind: 'callout',
            variant: 'info',
            title: 'Privacy by default',
            text: 'Email and phone are SHA-256 hashed before they leave the device. The plaintext never reaches our servers unless you explicitly enable the verified-contact flow for cross-app payout consolidation.',
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════
  // Ad Revenue (Slot/Seal) — THE NEW STAR SECTION
  // ════════════════════════════════════════════════════════════
  {
    id: 'ads',
    title: 'Ad Revenue (Slot / Seal)',
    icon: CurrencyDollar,
    color: 'text-emerald-500',
    sections: [
      {
        id: 'ads-architecture',
        title: 'Bypass-resistant architecture',
        icon: ShieldCheck,
        badge: 'v2.0',
        description: 'Why the new flow can\'t be forged by forking the SDK.',
        blocks: [
          {
            kind: 'paragraph',
            text: 'The first version of the SDK trusted the client to report revenue ("here\'s my ad, it earned $0.12"). That was bait — anyone could fork the SDK and post `revenue: 0`. The new flow inverts the trust direction.',
          },
          {
            kind: 'heading',
            level: 3,
            text: 'The two-step cycle',
          },
          {
            kind: 'diagram',
            diagram: {
              steps: [
                { num: 1, title: 'requestSlot()', desc: 'Server issues HMAC-signed token bound to (appId, userId, adType, nonce). 5-min TTL. Ad-unit ID is server-resolved — never in client config.' },
                { num: 2, title: 'Render', desc: 'Host app passes adUnitId to AdMob/Unity. SDK does NOT compute revenue.' },
                { num: 3, title: 'sealImpression()', desc: 'Token presented back. Server verifies signature + nonce, blocks replay via DB unique index, atomically credits user/dev/platform shares.' },
              ],
            },
          },
          {
            kind: 'heading',
            level: 3,
            text: 'Defense layers',
          },
          {
            kind: 'table',
            columns: ['Attack', 'Defense'],
            rows: [
              ['Fork SDK, post fake revenue', 'Client revenue is cross-check signal only — server resolves authoritative value from campaign auction or ad-network reporting.'],
              ['Replay the same slot', 'In-memory nonce ledger + DB unique partial index on slot_nonce.'],
              ['Tamper with the slot token', 'HMAC-SHA256 verification with canonical JSON serialization.'],
              ['Reuse another app\'s slot', 'App ID is bound inside the signed payload.'],
              ['Decompile SDK to steal ad-unit ID', 'Ad-unit IDs are issued per-slot by the server, not embedded in client config.'],
              ['Out-of-tolerance reported revenue', '±50% tolerance band; out-of-band values clamp to projection and flag the impression suspicious.'],
            ],
          },
          {
            kind: 'callout',
            variant: 'success',
            title: 'Demo it',
            text: 'pnpm run smoke:slot-seal exercises the happy path + replay + tamper + out-of-tolerance from a real client. Run before any demo.',
          },
        ],
      },
      {
        id: 'ads-banner',
        title: 'Banner ads',
        icon: VideoCamera,
        description: 'The simplest way to monetize: drop a component, get revenue.',
        blocks: [
          {
            kind: 'paragraph',
            text: 'BannerAd autoruns the slot → render → seal cycle. If you don\'t supply renderPlatformAd it shows a placeholder (useful for early dev). In production you wire it to AdMob/Unity Ads.',
          },
          {
            kind: 'code',
            examples: [
              {
                title: 'Minimal — placeholder ad',
                description: 'No ad SDK integration; great for testing the flow without an AdMob account.',
                language: 'tsx',
                code: `import { BannerAd } from '@dataclaus/sdk-react-native';

export function HomeScreen() {
  return (
    <View style={{ flex: 1 }}>
      <ScrollView>{/* your content */}</ScrollView>
      <BannerAd
        size="banner"
        onAdLoaded={() => console.log('Banner ready')}
        onPaidEvent={(impression) => {
          console.log(\`Earned \$\${impression.revenue.toFixed(4)}\`);
        }}
      />
    </View>
  );
}`,
              },
              {
                title: 'Production — wired to AdMob',
                description: 'renderPlatformAd lets the server reconcile revenue against AdMob\'s reported eCPM.',
                language: 'tsx',
                code: `import { BannerAd, type AdSlot } from '@dataclaus/sdk-react-native';
import { GAMBannerAd, BannerAdSize } from 'react-native-google-mobile-ads';

function renderAdMobBanner(slot: AdSlot) {
  return new Promise<{ reportedRevenue?: number }>((resolve) => {
    let reported: number | undefined;
    return (
      <GAMBannerAd
        unitId={slot.adUnitId}
        sizes={[BannerAdSize.BANNER]}
        onAdLoaded={() => resolve({ reportedRevenue: reported })}
        onPaidEvent={(e) => { reported = e.value / 1_000_000; }}
      />
    );
  });
}

export function HomeScreen() {
  return (
    <BannerAd
      size="banner"
      renderPlatformAd={renderAdMobBanner}
      onPaidEvent={(i) => analytics.track('ad_paid', { revenue: i.revenue })}
    />
  );
}`,
              },
            ],
          },
        ],
      },
      {
        id: 'ads-rewarded',
        title: 'Rewarded ads',
        icon: Cube,
        badge: 'highest eCPM',
        description: 'User taps "watch ad for 50 coins" — completion gates the reward.',
        blocks: [
          {
            kind: 'paragraph',
            text: 'Rewarded video has the highest eCPM (typically $20–$80) because completion is voluntary. The SDK only marks the impression `completed: true` if the platform ad SDK confirms a full view.',
          },
          {
            kind: 'code',
            examples: [
              {
                title: 'useRewardedAd — full preload + show pattern',
                description: 'Preload on screen mount, show on tap, immediately preload the next one.',
                language: 'tsx',
                code: `import { useEffect } from 'react';
import { useRewardedAd } from '@dataclaus/sdk-react-native';

export function CoinShop() {
  const {
    isLoaded, isLoading, error,
    load, show, reward,
  } = useRewardedAd({
    reward: { type: 'coins', amount: 50 },
    onRewarded: ({ amount, type }) => {
      addToWallet(type, amount);
      Toast.show(\`+\${amount} \${type}\`);
    },
    onPaidEvent: (i) => {
      analytics.track('rewarded_paid', { revenue: i.revenue });
    },
  });

  // Preload the first ad
  useEffect(() => { void load(); }, [load]);

  return (
    <TouchableOpacity
      disabled={!isLoaded || isLoading}
      onPress={async () => {
        const success = await show();
        if (success) void load(); // immediately preload next
      }}
      style={[styles.btn, !isLoaded && styles.btnDisabled]}
    >
      <Text>{isLoading ? 'Loading…' : 'Watch ad → 50 coins'}</Text>
    </TouchableOpacity>
  );
}`,
              },
              {
                title: 'AdMob integration with completion gate',
                description: 'Only mark `completed: true` when the user actually finished the video.',
                language: 'tsx',
                code: `import { useRewardedAd, type AdSlot } from '@dataclaus/sdk-react-native';
import { RewardedAd, RewardedAdEventType } from 'react-native-google-mobile-ads';

function renderRewarded(slot: AdSlot) {
  return new Promise<{ reportedRevenue?: number; completed?: boolean }>((resolve) => {
    const ad = RewardedAd.createForAdRequest(slot.adUnitId);
    let reported: number | undefined;
    let completed = false;
    ad.addAdEventListener(RewardedAdEventType.LOADED, () => ad.show());
    ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { completed = true; });
    ad.addAdEventListener('paid', (e: any) => { reported = e.value / 1_000_000; });
    ad.addAdEventListener('closed', () => resolve({ reportedRevenue: reported, completed }));
    ad.load();
  });
}

const { show } = useRewardedAd({ renderPlatformAd: renderRewarded });`,
              },
            ],
          },
          {
            kind: 'callout',
            variant: 'warning',
            title: 'Don\'t grant rewards client-side',
            text: 'Use the onRewarded callback to update local state, but persist the reward through your backend after listening to the dataclaus.impression.sealed webhook (see Webhooks).',
          },
        ],
      },
      {
        id: 'ads-interstitial',
        title: 'Interstitial ads',
        icon: StackSimple,
        description: 'Full-screen ads at natural breakpoints (between levels, after a save, etc).',
        blocks: [
          {
            kind: 'code',
            examples: [
              {
                title: 'useInterstitialAd',
                language: 'tsx',
                code: `import { useEffect } from 'react';
import { useInterstitialAd } from '@dataclaus/sdk-react-native';

export function GameOverScreen({ onContinue }: { onContinue: () => void }) {
  const { isLoaded, load, show } = useInterstitialAd({
    onPaidEvent: (i) => console.log(\`Earned \$\${i.revenue}\`),
  });

  useEffect(() => { void load(); }, [load]);

  return (
    <Button
      title="Next level"
      onPress={async () => {
        if (isLoaded) await show();
        onContinue();
      }}
    />
  );
}`,
              },
            ],
          },
          {
            kind: 'callout',
            variant: 'info',
            title: 'Frequency capping',
            text: 'Don\'t spam interstitials. The DataClaus quality score down-weights wallets associated with apps that show >1 interstitial per 60s, hurting your share of high-CPM advertiser bids.',
          },
        ],
      },
      {
        id: 'ads-manual',
        title: 'Manual slot/seal cycle',
        icon: GearSix,
        description: 'When you need full control — custom mediation, native bridges, etc.',
        blocks: [
          {
            kind: 'paragraph',
            text: 'The hooks/components above are convenience wrappers around the AdManager class. For non-React or fully-custom integrations, drive the cycle yourself.',
          },
          {
            kind: 'code',
            examples: [
              {
                title: 'AdManager — request, render, seal',
                language: 'typescript',
                code: `import { AdManager } from '@dataclaus/sdk-react-native';

const ads = new AdManager({
  apiUrl: process.env.DATACLAUS_API_URL!,
  applicationId: process.env.DATACLAUS_APP_ID!,
  userId: linkedUser.dataclausUserId,
  userToken: linkedUser.userToken,
});

// 1. Get a signed slot
const slot = await ads.requestSlot('rewarded');
//   slot.slotToken    → opaque, treat as bearer token
//   slot.adUnitId     → pass to AdMob/Unity
//   slot.expiresAt    → ISO timestamp, 5-min TTL
//   slot.projectedRevenue → UI hint only, NOT for ledger

// 2. Render with whatever ad SDK you want
const rendered = await yourCustomMediation(slot.adUnitId);

// 3. Seal — server reconciles & credits ledger atomically
const impression = await ads.sealImpression(slot, {
  reportedRevenue: rendered.cpm / 1000,  // cross-check signal
  completed: rendered.viewed,
});

if (impression) {
  console.log('Server-reconciled revenue:', impression.revenue);
}`,
              },
              {
                title: 'runCycle — one call for the whole flow',
                language: 'typescript',
                code: `const impression = await ads.runCycle('banner', async (slot) => {
  const result = await myAdSDK.show(slot.adUnitId);
  return { reportedRevenue: result.cpm / 1000 };
});`,
              },
            ],
          },
          {
            kind: 'apiref',
            title: 'AdManager.requestSlot(adType, qualityScoreHint?)',
            apiref: {
              signature: 'requestSlot(adType: AdType, qualityScoreHint?: number): Promise<AdSlot>',
              params: [
                { name: 'adType', type: '\'banner\' | \'interstitial\' | \'rewarded\' | \'native\'', required: true, description: 'Type of ad to request.' },
                { name: 'qualityScoreHint', type: 'number (0-1)', description: 'Optional quality score from your local fraud detector. Server clamps and verifies.' },
              ],
              returns: 'AdSlot { slotToken, adUnitId, adType, expiresAt, projectedRevenue }',
              throws: 'Error if the user is suspended, the app quota is exhausted, or attestation fails.',
            },
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════
  // Fraud Detection
  // ════════════════════════════════════════════════════════════
  {
    id: 'fraud',
    title: 'Fraud Detection',
    icon: Robot,
    color: 'text-red-500',
    sections: [
      {
        id: 'fraud-overview',
        title: 'On-device fraud signals',
        icon: MagnifyingGlass,
        description: 'Bot-, emulator-, and pattern-based signals computed locally so we don\'t pay bots.',
        blocks: [
          {
            kind: 'paragraph',
            text: 'The fraud detector runs continuously while the app is in the foreground, watching motion patterns, scroll throttling, touch biometrics, battery delta, and pedometer signals. Output is a single 0–1 fraudScore that\'s included in every ingest event.',
          },
          {
            kind: 'code',
            examples: [
              {
                title: 'useFraudDetection — read live signals',
                language: 'tsx',
                code: `import { useFraudDetection } from '@dataclaus/sdk-react-native';

export function FraudGate({ children }: { children: React.ReactNode }) {
  const { fraudScore, isBot, signals } = useFraudDetection({
    sensitivityLevel: 'medium', // 'low' | 'medium' | 'high'
  });

  if (isBot) {
    console.warn('Bot signals detected:', signals);
    return <BotPlaceholder />;
  }

  return (
    <>
      {children}
      <Text style={{ opacity: 0.3 }}>
        Quality: {(1 - fraudScore).toFixed(2)}
      </Text>
    </>
  );
}`,
              },
            ],
          },
          {
            kind: 'heading',
            level: 3,
            text: 'Signals tracked',
          },
          {
            kind: 'table',
            columns: ['Signal', 'What it detects'],
            rows: [
              ['MotionPattern', 'Repetitive accelerometer/gyroscope patterns typical of automation rigs.'],
              ['ScrollThrottle', 'Scroll velocity uniformity — bots scroll at suspiciously constant rates.'],
              ['TouchPattern', 'Pressure / area / velocity entropy of touches.'],
              ['BatteryDrain', 'Unrealistic battery curves (always 100%, instant drops).'],
              ['Pedometer', 'Fake pedometer events on emulators.'],
              ['Emulator', 'Build fingerprints + sensor presence checks.'],
            ],
          },
          {
            kind: 'callout',
            variant: 'info',
            title: 'Quality tier impact',
            text: 'Fraud score directly affects your wallet\'s quality tier (S/A/B/C). Higher tier → higher share of advertiser bids in the auction → more revenue per impression.',
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════
  // Sensor Tracking
  // ════════════════════════════════════════════════════════════
  {
    id: 'sensors',
    title: 'Sensor Data Pipeline',
    icon: Cpu,
    color: 'text-orange-500',
    sections: [
      {
        id: 'sensors-collect',
        title: 'Collect & batch',
        icon: CloudArrowUp,
        description: 'Buffer sensor events on-device, flush in batches.',
        blocks: [
          {
            kind: 'paragraph',
            text: 'The collector buffers up to N events (default 50) or T ms (default 5000) — whichever comes first — then ships them to your backend. Your backend in turn relays them to the DataClaus ingest endpoint with HMAC.',
          },
          {
            kind: 'code',
            examples: [
              {
                title: 'useDataClaus + expo-sensors',
                language: 'tsx',
                code: `import { Accelerometer, Gyroscope } from 'expo-sensors';
import { useDataClaus, useSensorTracking } from '@dataclaus/sdk-react-native';

export function SensorBoot() {
  const { collector, startCollection, stopCollection } = useDataClaus({
    backendUrl: 'https://your-backend.example/dataclaus',
    userId: linkedUser.dataclausUserId,
    debug: __DEV__,
    batchSize: 50,
    flushInterval: 5000,
  });

  useSensorTracking(collector, { Accelerometer, Gyroscope }, { interval: 100 });

  useEffect(() => {
    startCollection();
    return () => stopCollection();
  }, []);

  return null;
}`,
              },
              {
                title: 'Track screen views & custom events',
                language: 'tsx',
                code: `const { trackScreenView, trackCustomEvent } = useDataClaus(config);

useEffect(() => { trackScreenView('Home'); }, []);

// Custom funnel events:
trackCustomEvent('purchase_completed', { sku: 'gold-100', price: 4.99 });`,
              },
            ],
          },
          {
            kind: 'callout',
            variant: 'warning',
            title: 'Battery & data',
            text: 'Default 100ms sampling is fine for fraud detection. Don\'t go below 50ms unless your use case demands it — battery drain becomes user-visible.',
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════
  // Platform Attestation
  // ════════════════════════════════════════════════════════════
  {
    id: 'attestation',
    title: 'Platform Attestation',
    icon: ShieldCheck,
    color: 'text-cyan-500',
    sections: [
      {
        id: 'attestation-overview',
        title: 'App Attest / Play Integrity',
        icon: HandPalm,
        badge: 'optional',
        description: 'Cryptographic proof your app binary is the real one.',
        blocks: [
          {
            kind: 'paragraph',
            text: 'Apple App Attest (iOS) and Play Integrity (Android) sign a server-issued challenge with a key bound to your real, store-distributed app binary. Modified or repackaged apps cannot produce a valid signature.',
          },
          {
            kind: 'paragraph',
            text: 'The SDK ships with a pluggable provider. In dev/Expo Go we send a stub so the flow works end-to-end; in production you register a real provider that calls the native APIs.',
          },
          {
            kind: 'code',
            examples: [
              {
                title: 'Register a provider in app bootstrap',
                description: 'Wire this once at startup. Every requestSlot() call automatically attaches a fresh attestation if the provider exists.',
                language: 'typescript',
                code: `import {
  setAttestationProvider,
  type AttestationProvider,
} from '@dataclaus/sdk-react-native';
import { Platform } from 'react-native';
import * as AppAttest from 'react-native-ios-app-attest';
import { PlayIntegrity } from 'react-native-play-integrity';

const provider: AttestationProvider = {
  platform: Platform.OS === 'ios' ? 'ios' : 'android',
  async produce(challenge) {
    if (Platform.OS === 'ios') {
      const { keyId, attestation } = await AppAttest.attest(challenge);
      return { type: 'app-attest', keyId, attestation, challenge };
    } else {
      const token = await PlayIntegrity.requestIntegrityToken({ nonce: challenge });
      return { type: 'play-integrity', token, challenge };
    }
  },
};

setAttestationProvider(provider);`,
              },
            ],
          },
          {
            kind: 'callout',
            variant: 'info',
            title: 'When to enable',
            text: 'For capstone / MVP this is optional — the slot/seal flow already covers SDK forking. Enable App Attest before scaling to >$10k MRR or onboarding enterprise advertisers.',
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════
  // reCAPTCHA
  // ════════════════════════════════════════════════════════════
  {
    id: 'recaptcha',
    title: 'reCAPTCHA Enterprise',
    icon: Bug,
    color: 'text-yellow-500',
    sections: [
      {
        id: 'recaptcha-mobile',
        title: 'Mobile (silent assessment)',
        icon: DeviceMobile,
        description: 'Risk-scored, no UI puzzles. Wires into login + ad sealing.',
        blocks: [
          {
            kind: 'code',
            examples: [
              {
                title: 'useRecaptcha hook',
                language: 'tsx',
                code: `import { useRecaptcha } from '@dataclaus/sdk-react-native';

const { execute, isReady } = useRecaptcha({
  siteKey: process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY!,
});

const handleSubmit = async () => {
  if (!isReady) return;
  const { token, score } = await execute('login');
  await api.login({ ...credentials, recaptchaToken: token });
};`,
              },
            ],
          },
        ],
      },
      {
        id: 'recaptcha-server',
        title: 'Server-side verification',
        icon: Terminal,
        description: 'Verify the token, fetch the risk score, gate the request.',
        blocks: [
          {
            kind: 'code',
            examples: [
              {
                title: 'createRecaptchaMiddleware (Express)',
                language: 'typescript',
                filename: 'server/middleware/recaptcha.ts',
                code: `import { createRecaptchaMiddleware } from '@dataclaus/sdk-node';

export const recaptchaGuard = createRecaptchaMiddleware({
  projectId: process.env.GCP_PROJECT_ID!,
  apiKey: process.env.RECAPTCHA_API_KEY!,
  siteKey: process.env.RECAPTCHA_SITE_KEY!,
  minScore: 0.5,
  expectedAction: 'login',
});

app.post('/api/login', recaptchaGuard, loginHandler);`,
              },
            ],
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════
  // Server / HMAC
  // ════════════════════════════════════════════════════════════
  {
    id: 'server',
    title: 'Node.js Server SDK',
    icon: Terminal,
    color: 'text-emerald-600',
    sections: [
      {
        id: 'server-init',
        title: 'Initialize the client',
        icon: Plug,
        description: 'One client per process. Reuse it.',
        blocks: [
          {
            kind: 'code',
            examples: [
              {
                title: 'Initialize DataClausClient',
                language: 'typescript',
                code: `import { DataClausClient } from '@dataclaus/sdk-node';

export const dc = new DataClausClient({
  apiUrl: process.env.DATACLAUS_API_URL!,        // e.g. https://api.dataclaus.io
  apiKey: process.env.DATACLAUS_API_KEY!,        // sk_live_…
  developerId: process.env.DATACLAUS_DEVELOPER_ID!,
});

// Optional: verify the credentials work
const ok = await dc.verify();
if (!ok) throw new Error('DataClaus client misconfigured');`,
              },
            ],
          },
        ],
      },
      {
        id: 'server-ingest',
        title: 'Ingest sensor batches (HMAC)',
        icon: CloudArrowUp,
        description: 'Receive events from your mobile app, forward to DataClaus signed with HMAC.',
        blocks: [
          {
            kind: 'paragraph',
            text: 'Your backend acts as a trust boundary: it knows the server-only API key, computes a per-request HMAC, and forwards the events. The DataClaus API rejects any batch without a valid signature + replay-fresh timestamp.',
          },
          {
            kind: 'code',
            examples: [
              {
                title: 'Express endpoint — proxy mobile events to DataClaus',
                language: 'typescript',
                filename: 'server/routes/dataclaus.ts',
                code: `import { dc } from '../dataclaus-client';

app.post('/dataclaus/events', async (req, res) => {
  const { events, session, recaptchaToken } = req.body;

  // Optional but recommended: verify the request came from your real mobile app.
  // (See reCAPTCHA section.)

  try {
    const result = await dc.ingestBatch(events, {
      session,
      recaptchaToken,
    });
    res.json({ accepted: result.processedCount, errors: result.errors });
  } catch (err) {
    console.error('DataClaus ingest failed:', err);
    res.status(502).json({ error: 'upstream_failure' });
  }
});`,
              },
              {
                title: 'NestJS controller variant',
                language: 'typescript',
                code: `@Controller('dataclaus')
export class DataClausController {
  constructor(@Inject(DATACLAUS_CLIENT) private dc: DataClausClient) {}

  @Post('events')
  @UseGuards(RecaptchaGuard)
  async ingest(@Body() body: IngestBatchDto) {
    return this.dc.ingestBatch(body.events, {
      session: body.session,
      recaptchaToken: body.recaptchaToken,
    });
  }
}`,
              },
            ],
          },
          {
            kind: 'apiref',
            title: 'dc.ingestBatch(events, options)',
            apiref: {
              signature: 'ingestBatch(events: SensorEvent[], options: { session: IngestSessionInfo, recaptchaToken?: string }): Promise<BatchIngestResponse>',
              params: [
                { name: 'events', type: 'SensorEvent[]', required: true, description: 'Up to 100 events per call. Each must include eventId, externalUserId, timestamp, fraudScore.' },
                { name: 'session.sessionId', type: 'string (UUID)', required: true, description: 'Group identifier, stable for the session.' },
                { name: 'recaptchaToken', type: 'string', description: 'Forward the mobile reCAPTCHA token for server-side risk scoring.' },
              ],
              returns: '{ success, processedCount, errors? }',
              throws: 'Throws on network failure, invalid HMAC (rotate key), or 4xx responses.',
            },
          },
          {
            kind: 'callout',
            variant: 'danger',
            title: 'Never ship the API key to the client',
            text: 'Mobile bundles ship to thousands of devices. The DATACLAUS_API_KEY belongs in your server env vars only — anything that lives in EXPO_PUBLIC_* / NEXT_PUBLIC_* / process.env on RN is shipped to the client.',
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════
  // Webhooks
  // ════════════════════════════════════════════════════════════
  {
    id: 'webhooks',
    title: 'Webhooks',
    icon: Bell,
    color: 'text-pink-500',
    sections: [
      {
        id: 'webhooks-events',
        title: 'Available events',
        icon: ListChecks,
        description: 'Real-time push of impression seals, payouts, and quality changes.',
        blocks: [
          {
            kind: 'table',
            columns: ['Event', 'When fired', 'Idempotency key'],
            rows: [
              ['impression.sealed', 'After /ads/seal commits the ledger transfer.', 'impression_id'],
              ['user.earned', 'After any non-zero credit to a user wallet.', 'transaction_id'],
              ['user.quality_changed', 'When a wallet crosses a quality tier boundary.', 'user_id+to_tier+at'],
              ['payout.processed', 'Stripe Connect or manual payout completes.', 'payout_id'],
              ['app.suspended', 'Your app gets quarantined for fraud.', 'app_id+reason'],
            ],
          },
          {
            kind: 'code',
            examples: [
              {
                title: 'Express webhook receiver',
                description: 'Always verify the HMAC before doing any work — the URL is public.',
                language: 'typescript',
                filename: 'server/routes/webhooks.ts',
                code: `import crypto from 'crypto';
import express from 'express';

const SECRET = process.env.DATACLAUS_WEBHOOK_SECRET!;

app.post(
  '/webhooks/dataclaus',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const signature = req.header('X-DataClaus-Signature') ?? '';
    const expected = crypto
      .createHmac('sha256', SECRET)
      .update(req.body)
      .digest('hex');

    if (!crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    )) {
      return res.status(401).end();
    }

    const event = JSON.parse(req.body.toString());
    switch (event.type) {
      case 'impression.sealed':
        return handleSealed(event.data);
      case 'user.earned':
        return handleEarning(event.data);
      case 'payout.processed':
        return handlePayout(event.data);
    }
    res.json({ received: true });
  },
);`,
              },
              {
                title: 'Sample payload — impression.sealed',
                language: 'json',
                code: `{
  "id": "evt_01HM5Q8X9KTWJ4P",
  "type": "impression.sealed",
  "created_at": "2026-05-09T14:22:11.842Z",
  "data": {
    "impression_id": "imp_01HM5Q8X3M7B2",
    "application_id": "app_4K9XJ2",
    "user_id": "usr_8R7Q3N",
    "ad_type": "rewarded",
    "gross_revenue": 0.0421,
    "user_share": 0.0295,
    "dev_share": 0.0105,
    "platform_fee": 0.0021,
    "currency": "USD",
    "quality_score": 0.94,
    "suspicious": false
  }
}`,
              },
            ],
          },
          {
            kind: 'callout',
            variant: 'warning',
            title: 'Idempotency',
            text: 'We will retry up to 4 times with exponential backoff if your endpoint times out. Keep handlers idempotent — store impression_id / transaction_id and dedupe.',
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════
  // API Reference (compact)
  // ════════════════════════════════════════════════════════════
  {
    id: 'reference',
    title: 'API Reference',
    icon: Globe,
    color: 'text-slate-600',
    sections: [
      {
        id: 'rest-endpoints',
        title: 'REST endpoints',
        icon: ShareNetwork,
        description: 'The surface you actually call.',
        blocks: [
          {
            kind: 'table',
            columns: ['Method', 'Path', 'Auth', 'Purpose'],
            rows: [
              ['POST', '/auth/request-otp', 'public', 'Email-based OTP, 6-digit code.'],
              ['POST', '/auth/verify-otp', 'public', 'Returns access + refresh tokens.'],
              ['POST', '/applications/:id/users/link', 'Bearer (user)', 'Link external user → DataClaus wallet.'],
              ['GET',  '/users/:id/earnings', 'Bearer (user)', 'Wallet totals + quality score.'],
              ['POST', '/applications/:id/ads/slot', 'Bearer (user)', 'Issue HMAC-signed ad slot.'],
              ['POST', '/applications/:id/ads/seal', 'Bearer (user)', 'Commit impression. Server resolves revenue.'],
              ['POST', '/v1/ingest/batch', 'HMAC (server)', 'Sensor event ingest, ≤100 per call.'],
              ['POST', '/webhooks/test', 'HMAC (server)', 'Echo a test webhook to your registered URL.'],
            ],
          },
        ],
      },
      {
        id: 'env-vars',
        title: 'Environment variables',
        icon: GearSix,
        description: 'Everything the SDKs read at runtime.',
        blocks: [
          {
            kind: 'table',
            columns: ['Name', 'Side', 'Description'],
            rows: [
              ['DATACLAUS_API_URL', 'both', 'Base URL of the DataClaus core API.'],
              ['DATACLAUS_APP_ID', 'client', 'Public application identifier.'],
              ['DATACLAUS_API_KEY', 'server only', 'sk_live_… — never ship to the client.'],
              ['DATACLAUS_DEVELOPER_ID', 'server only', 'Your developer UUID.'],
              ['DATACLAUS_WEBHOOK_SECRET', 'server only', 'whsec_… — verify webhook HMAC.'],
              ['EXPO_PUBLIC_RECAPTCHA_SITE_KEY', 'client', 'reCAPTCHA Enterprise site key.'],
              ['RECAPTCHA_API_KEY', 'server only', 'GCP API key for assessment.'],
            ],
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════
  // Best Practices & Troubleshooting
  // ════════════════════════════════════════════════════════════
  {
    id: 'best-practices',
    title: 'Best Practices',
    icon: ChartLineUp,
    color: 'text-amber-600',
    sections: [
      {
        id: 'do-dont',
        title: 'Do / Don\'t',
        icon: Heartbeat,
        description: 'Pattern hits we\'ve seen across pilot integrators.',
        blocks: [
          {
            kind: 'table',
            columns: ['Do', 'Don\'t'],
            rows: [
              ['Wire renderPlatformAd in production for revenue reconciliation.', 'Skip renderPlatformAd and rely on server projection alone.'],
              ['Persist linkedUser.userToken in expo-secure-store; refresh before expiry.', 'Re-link on every app launch — creates wallet ambiguity.'],
              ['Cap interstitial frequency to ≤1 per 60 s.', 'Show interstitials on every navigation — your quality tier will drop.'],
              ['Use webhooks (impression.sealed) for granting in-game rewards.', 'Trust the client onRewarded callback for permanent rewards.'],
              ['Run pnpm run smoke:slot-seal before every demo.', 'Demo without verifying the integration end-to-end.'],
              ['Rotate DATACLAUS_API_KEY quarterly.', 'Embed the API key in your mobile bundle.'],
            ],
          },
        ],
      },
      {
        id: 'troubleshooting',
        title: 'Troubleshooting',
        icon: Lifebuoy,
        description: 'Symptoms → likely cause.',
        blocks: [
          {
            kind: 'table',
            columns: ['Symptom', 'Likely cause', 'Fix'],
            rows: [
              ['Slot request returns 401', 'userToken expired (24h TTL).', 'Call refreshTokens() or re-link.'],
              ['Seal returns 409', 'Replay — same slot already sealed.', 'Generate a new slot. Don\'t cache slot tokens across renders.'],
              ['Seal returns 422 with suspicious=true', 'Reported revenue >50% off projection.', 'Check your AdMob unit\'s eCPM. The impression still credits at the projection.'],
              ['Ingest returns 401 invalid_signature', 'Server clock drift > 5 minutes.', 'Sync NTP. The HMAC includes a timestamp.'],
              ['Banner placeholder never resolves', 'No renderPlatformAd, no AdMob, expected behavior.', 'Wire renderPlatformAd or accept the placeholder in dev.'],
              ['Webhook signature mismatch', 'Body parser ate the raw bytes.', 'Use express.raw() before this route. Compute HMAC over the raw buffer.'],
            ],
          },
        ],
      },
    ],
  },
];

// ============================================================
// Reusable: Syntax Highlighter
// ============================================================

function SyntaxHighlighter({ code, language, filename }: { code: string; language: string; filename?: string }) {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-xl overflow-hidden border border-slate-800/40">
      {filename && (
        <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center gap-2 text-xs text-slate-400">
          <Code size={12} />
          <span className="font-mono">{filename}</span>
        </div>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={copyCode}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-white hover:bg-slate-700 z-10 h-8 w-8 p-0"
      >
        {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
      </Button>
      <Highlight theme={themes.nightOwl} code={code.trim()} language={language as any}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className="p-4 text-sm overflow-x-auto font-mono leading-relaxed"
            style={{ ...style, margin: 0 }}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                <span className="text-slate-600 select-none mr-4 text-xs w-6 inline-block text-right">
                  {i + 1}
                </span>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}

// ============================================================
// Block renderers
// ============================================================

const calloutStyles = {
  info: {
    border: 'border-blue-200/60',
    bg: 'bg-blue-50/70',
    icon: Info,
    iconColor: 'text-blue-600',
    titleColor: 'text-blue-900',
    textColor: 'text-blue-800',
  },
  warning: {
    border: 'border-amber-200/60',
    bg: 'bg-amber-50/70',
    icon: Warning,
    iconColor: 'text-amber-600',
    titleColor: 'text-amber-900',
    textColor: 'text-amber-800',
  },
  success: {
    border: 'border-emerald-200/60',
    bg: 'bg-emerald-50/70',
    icon: CheckCircle,
    iconColor: 'text-emerald-600',
    titleColor: 'text-emerald-900',
    textColor: 'text-emerald-800',
  },
  danger: {
    border: 'border-red-200/60',
    bg: 'bg-red-50/70',
    icon: Warning,
    iconColor: 'text-red-600',
    titleColor: 'text-red-900',
    textColor: 'text-red-800',
  },
};

function Callout({ block }: { block: DocBlock }) {
  const style = calloutStyles[block.variant ?? 'info'];
  const Icon = style.icon;
  return (
    <div className={`rounded-xl border ${style.border} ${style.bg} p-4 flex gap-3`}>
      <Icon size={20} className={`${style.iconColor} flex-shrink-0 mt-0.5`} weight="duotone" />
      <div className="flex-1">
        {block.title && <h4 className={`font-semibold ${style.titleColor} mb-1`}>{block.title}</h4>}
        <p className={`text-sm ${style.textColor} leading-relaxed`}>{block.text}</p>
      </div>
    </div>
  );
}

function StepDiagram({ steps }: { steps: { num: number; title: string; desc: string }[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      {steps.map((s, i) => (
        <motion.div
          key={s.num}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          className="relative rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              {s.num}
            </div>
            <h4 className="font-semibold text-slate-900 text-sm">{s.title}</h4>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
          {i < steps.length - 1 && (
            <ArrowRight
              className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 text-slate-300"
              size={16}
            />
          )}
        </motion.div>
      ))}
    </div>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((col, i) => (
              <th key={i} className="px-4 py-3 text-left font-semibold text-slate-700 border-b border-slate-200">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 ? 'bg-slate-50/30' : 'bg-white'}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-slate-600 border-b border-slate-100 align-top">
                  {cell.match(/^(GET|POST|PUT|DELETE|PATCH)$/) ? (
                    <code className={`text-xs font-mono px-2 py-0.5 rounded ${
                      cell === 'GET' ? 'bg-emerald-100 text-emerald-700' :
                      cell === 'POST' ? 'bg-blue-100 text-blue-700' :
                      cell === 'DELETE' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>{cell}</code>
                  ) : cell.startsWith('/') || cell.includes('_id') ? (
                    <code className="text-xs font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">{cell}</code>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ApiRefBlock({ apiRef }: { apiRef: ApiRef & { title?: string } }) {
  const ref = apiRef;
  return (
    <Card className="border border-slate-200 bg-gradient-to-br from-slate-50 to-white">
      <CardHeader className="pb-3">
        <CardTitle className="font-mono text-sm text-slate-800 flex items-center gap-2">
          <Code size={14} className="text-blue-500" />
          {ref.signature}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {ref.params && ref.params.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Parameters</p>
            <div className="space-y-2">
              {ref.params.map((p) => (
                <div key={p.name} className="flex flex-col gap-0.5 pl-3 border-l-2 border-slate-200">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs font-mono text-slate-900 font-semibold">{p.name}</code>
                    <code className="text-xs font-mono text-slate-500">{p.type}</code>
                    {p.required && <Badge className="text-[9px] bg-red-100 text-red-700 border-0 px-1.5 py-0">required</Badge>}
                  </div>
                  <p className="text-xs text-slate-600">{p.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {ref.returns && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Returns</p>
            <code className="text-xs font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded inline-block">{ref.returns}</code>
          </div>
        )}
        {ref.throws && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Throws</p>
            <p className="text-xs text-slate-600">{ref.throws}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BlockRenderer({ block }: { block: DocBlock }) {
  switch (block.kind) {
    case 'paragraph':
      return <p className="text-slate-600 leading-relaxed">{block.text}</p>;
    case 'heading': {
      const Tag = (block.level === 4 ? 'h4' : block.level === 2 ? 'h2' : 'h3') as keyof React.JSX.IntrinsicElements;
      const cls =
        block.level === 4
          ? 'text-base font-semibold text-slate-800 mt-2'
          : block.level === 2
          ? 'text-2xl font-bold text-slate-900 mt-4'
          : 'text-lg font-semibold text-slate-800 mt-2';
      return <Tag className={cls}>{block.text}</Tag>;
    }
    case 'list':
      return (
        <ul className="space-y-2">
          {(block.items ?? []).map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
              <CheckCircle size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" weight="fill" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case 'callout':
      return <Callout block={block} />;
    case 'code':
      return (
        <div className="space-y-3">
          {(block.examples ?? []).map((ex, i) => (
            <div key={i}>
              <div className="mb-2">
                <p className="font-semibold text-slate-800 text-sm">{ex.title}</p>
                {ex.description && <p className="text-xs text-slate-500">{ex.description}</p>}
              </div>
              <SyntaxHighlighter code={ex.code} language={ex.language} filename={ex.filename} />
            </div>
          ))}
        </div>
      );
    case 'diagram':
      return <StepDiagram steps={block.diagram?.steps ?? []} />;
    case 'table':
      return <DataTable columns={block.columns ?? []} rows={block.rows ?? []} />;
    case 'apiref':
      return block.apiref ? <ApiRefBlock apiRef={{ ...block.apiref, title: block.title }} /> : null;
    default:
      return null;
  }
}

// ============================================================
// Sidebar
// ============================================================

function Sidebar({
  active,
  onJump,
  query,
  onQuery,
  onClose,
}: {
  active: string;
  onJump: (id: string) => void;
  query: string;
  onQuery: (q: string) => void;
  onClose?: () => void;
}) {
  const filtered = useMemo(() => {
    if (!query.trim()) return docs;
    const q = query.toLowerCase();
    return docs
      .map((cat) => ({
        ...cat,
        sections: cat.sections.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q) ||
            cat.title.toLowerCase().includes(q),
        ),
      }))
      .filter((cat) => cat.sections.length > 0);
  }, [query]);

  return (
    <aside className="space-y-6">
      <div className="relative">
        <MagnifyingGlass
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          placeholder="Search docs…"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
        />
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <nav className="space-y-5">
        {filtered.map((cat) => {
          const CatIcon = cat.icon;
          return (
            <div key={cat.id}>
              <div className="flex items-center gap-2 mb-2 px-2">
                <CatIcon size={14} className={cat.color} weight="duotone" />
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                  {cat.title}
                </span>
              </div>
              <ul className="space-y-0.5">
                {cat.sections.map((s) => {
                  const SecIcon = s.icon;
                  const isActive = active === s.id;
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => onJump(s.id)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors text-left ${
                          isActive
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <SecIcon size={12} className="flex-shrink-0" />
                        <span className="flex-1 truncate">{s.title}</span>
                        {s.badge && (
                          <Badge className="text-[9px] bg-blue-100 text-blue-700 border-0 px-1.5 py-0 ml-1">
                            {s.badge}
                          </Badge>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

// ============================================================
// Main page
// ============================================================

export default function DocsPage() {
  const { user } = useAuth();
  const [active, setActive] = useState<string>('overview');
  const [query, setQuery] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Highlight the section currently in view as the user scrolls.
  useEffect(() => {
    const allIds = docs.flatMap((c) => c.sections.map((s) => s.id));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    allIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  if (!user) return null;

  const handleJump = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActive(id);
    setMobileSidebarOpen(false);
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white p-8 relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] bg-blue-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-1/2 -left-1/4 w-[600px] h-[600px] bg-purple-500/20 rounded-full blur-3xl" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
              <Book size={20} weight="duotone" />
            </div>
            <div>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-0 mb-1">v2.0 · Slot/Seal</Badge>
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-2 tracking-tight">DataClaus SDK Documentation</h1>
          <p className="text-slate-300 max-w-2xl">
            Everything you need to integrate bypass-resistant ad revenue, identity linking, fraud
            detection, and sensor ingestion. From <code className="text-emerald-300 bg-white/5 px-1.5 py-0.5 rounded text-sm">npm install</code> to your first paid impression in under 10 minutes.
          </p>
          <div className="flex flex-wrap gap-2 mt-5">
            <button
              onClick={() => handleJump('quickstart')}
              className="bg-white text-slate-900 hover:bg-slate-100 transition-colors px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
            >
              <Rocket size={14} weight="duotone" /> Quick Start
              <ArrowRight size={12} />
            </button>
            <button
              onClick={() => handleJump('ads-architecture')}
              className="bg-white/10 hover:bg-white/15 backdrop-blur transition-colors px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <ShieldCheck size={14} weight="duotone" /> Anti-Bypass Architecture
            </button>
            <button
              onClick={() => handleJump('rest-endpoints')}
              className="bg-white/10 hover:bg-white/15 backdrop-blur transition-colors px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <Globe size={14} weight="duotone" /> API Reference
            </button>
          </div>
        </div>
      </motion.div>

      {/* Mobile sidebar toggle */}
      <div className="lg:hidden mb-4">
        <Button
          variant="outline"
          onClick={() => setMobileSidebarOpen(true)}
          className="w-full"
        >
          <ListIcon size={14} className="mr-2" />
          Browse sections
        </Button>
      </div>

      <div className="flex gap-8">
        {/* Sidebar — desktop */}
        <div className="hidden lg:block w-64 flex-shrink-0">
          <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto pb-8 pr-2">
            <Sidebar
              active={active}
              onJump={handleJump}
              query={query}
              onQuery={setQuery}
            />
          </div>
        </div>

        {/* Sidebar — mobile drawer */}
        <AnimatePresence>
          {mobileSidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileSidebarOpen(false)}
                className="lg:hidden fixed inset-0 bg-black/50 z-40"
              />
              <motion.div
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: 'spring', damping: 25 }}
                className="lg:hidden fixed top-0 left-0 bottom-0 w-72 bg-white z-50 p-4 overflow-y-auto"
              >
                <Sidebar
                  active={active}
                  onJump={handleJump}
                  query={query}
                  onQuery={setQuery}
                  onClose={() => setMobileSidebarOpen(false)}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main content */}
        <main className="flex-1 min-w-0 space-y-12 pb-32">
          {docs.map((cat) => {
            const CatIcon = cat.icon;
            return (
              <div key={cat.id} className="space-y-8">
                {/* Category header */}
                <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
                  <CatIcon size={22} className={cat.color} weight="duotone" />
                  <h2 className="text-xl font-bold text-slate-900">{cat.title}</h2>
                </div>

                {/* Sections */}
                {cat.sections.map((sec) => {
                  const SecIcon = sec.icon;
                  return (
                    <section
                      key={sec.id}
                      id={sec.id}
                      className="scroll-mt-6"
                    >
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-1">
                          <SecIcon size={20} className="text-slate-700" weight="duotone" />
                          <h3 className="text-2xl font-bold text-slate-900">{sec.title}</h3>
                          {sec.badge && (
                            <Badge className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0">
                              {sec.badge}
                            </Badge>
                          )}
                        </div>
                        <p className="text-slate-500">{sec.description}</p>
                      </div>

                      <div className="space-y-5">
                        {sec.blocks.map((block, i) => (
                          <BlockRenderer key={i} block={block} />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            );
          })}

          {/* Footer */}
          <div className="border-t border-slate-200 pt-8 mt-12">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="bg-blue-50/50 border-blue-200/50">
                <CardContent className="p-5 flex items-start gap-3">
                  <Lifebuoy size={22} className="text-blue-600 flex-shrink-0 mt-0.5" weight="duotone" />
                  <div>
                    <h4 className="font-semibold text-blue-900 text-sm mb-1">Stuck?</h4>
                    <p className="text-xs text-blue-700">
                      Email <code className="bg-blue-100 px-1 rounded">support@dataclaus.io</code> with your App ID and we'll triage.
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-emerald-50/50 border-emerald-200/50">
                <CardContent className="p-5 flex items-start gap-3">
                  <ShieldCheck size={22} className="text-emerald-600 flex-shrink-0 mt-0.5" weight="duotone" />
                  <div>
                    <h4 className="font-semibold text-emerald-900 text-sm mb-1">Security disclosure</h4>
                    <p className="text-xs text-emerald-700">
                      Found a vulnerability? <code className="bg-emerald-100 px-1 rounded">security@dataclaus.io</code> — PGP key on the website.
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-purple-50/50 border-purple-200/50">
                <CardContent className="p-5 flex items-start gap-3">
                  <ChartLineUp size={22} className="text-purple-600 flex-shrink-0 mt-0.5" weight="duotone" />
                  <div>
                    <h4 className="font-semibold text-purple-900 text-sm mb-1">Status & uptime</h4>
                    <p className="text-xs text-purple-700">
                      Live at <code className="bg-purple-100 px-1 rounded">status.dataclaus.io</code> — 99.95% SLA on the API.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
