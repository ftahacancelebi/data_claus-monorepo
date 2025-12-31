/**
 * DataClaus Earnings & Ads Demo Screen
 *
 * Demonstrates:
 * 1. User Identity Linking
 * 2. Displaying Banner Ads
 * 3. Rewarded Ads for in-app currency
 * 4. Earnings tracking
 */

import { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';

// Import new SDK modules
import {
  useIdentity,
  AdProvider,
  BannerAd,
  useRewardedAd,
  type AdReward,
  type AdImpression,
} from '@dataclaus/sdk-react-native';

// ============================================
// CONFIGURATION
// ============================================

const getBackendUrl = () => {
  if (Platform.OS === 'web') return 'http://localhost:4000';

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:4000`;
  }

  return Platform.OS === 'android'
    ? 'http://10.0.2.2:4000'
    : 'http://localhost:4000';
};

const BACKEND_URL = getBackendUrl();
const APP_ID = 'demo-app-' + Date.now().toString(36);

// Simulated user (in real app, this comes from your auth system)
const MOCK_USER = {
  id: 'user_' + Math.random().toString(36).substring(2, 10),
  email: 'demo@dataclaus.io',
  name: 'Demo User',
};

// ============================================
// REWARDED AD BUTTON COMPONENT
// ============================================

function RewardedAdButton({ onReward }: { onReward: (coins: number) => void }) {
  const { isLoaded, isLoading, load, show } = useRewardedAd({
    onRewarded: (reward: AdReward) => {
      onReward(reward.amount);
      Alert.alert(
        '🎉 Reward Earned!',
        `You earned ${reward.amount} coins!\n\nThis revenue is split:\n• 70% to you\n• 25% to developer\n• 5% platform fee`
      );
    },
    onPaidEvent: (impression: AdImpression) => {
      console.log(`Ad revenue: $${impression.revenue}`);
    },
  });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePress = async () => {
    if (isLoaded) {
      await show();
      load(); // Preload next ad
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.rewardButton,
        !isLoaded && styles.rewardButtonDisabled,
      ]}
      onPress={handlePress}
      disabled={!isLoaded || isLoading}
    >
      {isLoading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <>
          <Text style={styles.rewardButtonEmoji}>🎬</Text>
          <Text style={styles.rewardButtonText}>
            {isLoaded ? 'Watch Ad for 50 Coins' : 'Loading Ad...'}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ============================================
// ADS SECTION COMPONENT
// ============================================

function AdsSection({ userToken, onReward }: { userToken: string; onReward: (coins: number) => void }) {
  return (
    <AdProvider
      config={{
        apiUrl: BACKEND_URL,
        applicationId: APP_ID,
        userToken: userToken,
        testMode: true,
        debug: true,
      }}
    >
      <View style={styles.adsContainer}>
        {/* Banner Ad */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📺 Banner Ad</Text>
          <Text style={styles.cardSubtitle}>
            Standard display ad - passive revenue
          </Text>
          <View style={styles.bannerContainer}>
            <BannerAd
              size="banner"
              onAdLoaded={() => console.log('Banner loaded')}
              onAdError={(error: string) => console.log('Banner error:', error)}
              onPaidEvent={(impression: AdImpression) => {
                console.log(`Banner earned: $${impression.revenue}`);
              }}
            />
          </View>
        </View>

        {/* Rewarded Ad */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🎁 Rewarded Ad</Text>
          <Text style={styles.cardSubtitle}>
            User watches ad → earns in-app reward + real money
          </Text>
          <RewardedAdButton onReward={onReward} />
        </View>
      </View>
    </AdProvider>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function EarningsScreen() {
  // State
  const [coins, setCoins] = useState(0);
  const [isLinking, setIsLinking] = useState(false);

  // Identity hook
  const {
    linkedUser,
    linkUser,
    earnings,
    isLinked,
    isLoading,
    error,
    refreshEarnings,
  } = useIdentity({
    apiUrl: BACKEND_URL,
    applicationId: APP_ID,
    debug: true,
  });

  // Link user on mount
  useEffect(() => {
    if (!isLinked && !isLinking && !error) {
      handleLink();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLink = async () => {
    setIsLinking(true);
    try {
      await linkUser({
        externalUserId: MOCK_USER.id,
        email: MOCK_USER.email,
      });
      Alert.alert(
        'Connected! 🎉',
        'Your account is now linked to DataClaus. You can start earning from ads!'
      );
    } catch (e) {
      console.log('Link failed (expected in demo):', e);
      // In demo mode, we simulate a successful link
    } finally {
      setIsLinking(false);
    }
  };

  const handleReward = (amount: number) => {
    setCoins((prev) => prev + amount);
  };

  return (
    <ScrollView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>💰</Text>
        <Text style={styles.title}>Earnings Demo</Text>
        <Text style={styles.subtitle}>User Identity + Ad Revenue</Text>
        <View style={styles.sdkBadge}>
          <Text style={styles.sdkBadgeText}>SDK v2.0.0</Text>
        </View>
      </View>

      {/* Connection Status */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>👤 Identity Status</Text>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: isLinked
                  ? '#22c55e'
                  : isLinking || isLoading
                  ? '#f59e0b'
                  : '#ef4444',
              },
            ]}
          />
          <Text style={styles.statusText}>
            {isLinked
              ? 'Connected to DataClaus'
              : isLinking || isLoading
              ? 'Linking...'
              : 'Not Connected'}
          </Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorHint}>
              (Demo mode - continues without backend)
            </Text>
          </View>
        )}

        <View style={styles.userInfo}>
          <Text style={styles.userInfoLabel}>User ID:</Text>
          <Text style={styles.userInfoValue}>{MOCK_USER.id}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userInfoLabel}>Email:</Text>
          <Text style={styles.userInfoValue}>{MOCK_USER.email}</Text>
        </View>

        {linkedUser && (
          <>
            <View style={styles.divider} />
            <View style={styles.userInfo}>
              <Text style={styles.userInfoLabel}>DataClaus ID:</Text>
              <Text style={styles.userInfoValue}>
                {linkedUser.dataclausUserId.substring(0, 12)}...
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userInfoLabel}>Wallet:</Text>
              <Text style={styles.userInfoValue}>
                {linkedUser.walletId.substring(0, 12)}...
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Earnings Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>💎 Your Earnings</Text>

        <View style={styles.earningsGrid}>
          <View style={styles.earningItem}>
            <Text style={styles.earningValue}>
              ${earnings?.totalEarned?.toFixed(4) || '0.0000'}
            </Text>
            <Text style={styles.earningLabel}>Total Earned</Text>
          </View>
          <View style={styles.earningItem}>
            <Text style={styles.earningValue}>
              ${earnings?.pendingBalance?.toFixed(4) || '0.0000'}
            </Text>
            <Text style={styles.earningLabel}>Pending</Text>
          </View>
          <View style={styles.earningItem}>
            <Text style={styles.earningValue}>
              ${earnings?.availableBalance?.toFixed(4) || '0.0000'}
            </Text>
            <Text style={styles.earningLabel}>Available</Text>
          </View>
        </View>

        <View style={styles.qualityRow}>
          <Text style={styles.qualityLabel}>Quality Score:</Text>
          <View style={styles.qualityBar}>
            <View
              style={[
                styles.qualityFill,
                { width: `${(earnings?.qualityScore || 0) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.qualityValue}>
            {((earnings?.qualityScore || 0) * 100).toFixed(0)}%
          </Text>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={refreshEarnings}
          disabled={isLoading}
        >
          <Text style={styles.refreshText}>
            {isLoading ? 'Refreshing...' : '🔄 Refresh'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* In-App Currency */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🪙 In-App Coins</Text>
        <View style={styles.coinsDisplay}>
          <Text style={styles.coinsValue}>{coins}</Text>
          <Text style={styles.coinsLabel}>coins</Text>
        </View>
        <Text style={styles.coinsHint}>
          Earn coins by watching ads! Use them in the app.
        </Text>
      </View>

      {/* Ads Section */}
      <AdsSection
        userToken={linkedUser?.userToken || 'demo-token'}
        onReward={handleReward}
      />

      {/* Revenue Split Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>📊 Revenue Distribution</Text>
        <Text style={styles.infoText}>
          When you watch ads, revenue is automatically split:
        </Text>
        <View style={styles.splitRow}>
          <View style={[styles.splitBar, { flex: 0.7, backgroundColor: '#22c55e' }]} />
          <View style={[styles.splitBar, { flex: 0.25, backgroundColor: '#3b82f6' }]} />
          <View style={[styles.splitBar, { flex: 0.05, backgroundColor: '#6b7280' }]} />
        </View>
        <View style={styles.splitLabels}>
          <Text style={styles.splitLabel}>70% You</Text>
          <Text style={styles.splitLabel}>25% Dev</Text>
          <Text style={styles.splitLabel}>5% Platform</Text>
        </View>
      </View>

      {/* Config Display */}
      <View style={styles.configCard}>
        <Text style={styles.configTitle}>Configuration</Text>
        <Text style={styles.configText}>Backend: {BACKEND_URL}</Text>
        <Text style={styles.configText}>App ID: {APP_ID.substring(0, 15)}...</Text>
        <Text style={styles.configText}>SDK: @dataclaus/sdk-react-native v2.0.0</Text>
      </View>

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 30,
    backgroundColor: '#1e293b',
  },
  logo: {
    fontSize: 64,
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 5,
  },
  sdkBadge: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#22c55e',
    borderRadius: 20,
  },
  sdkBadgeText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    margin: 16,
    marginBottom: 0,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  statusText: {
    fontSize: 16,
    color: '#e2e8f0',
  },
  errorBox: {
    backgroundColor: '#7f1d1d',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
  },
  errorHint: {
    color: '#f87171',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  userInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  userInfoLabel: {
    color: '#94a3b8',
    fontSize: 14,
  },
  userInfoValue: {
    color: '#e2e8f0',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 12,
  },
  earningsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  earningItem: {
    alignItems: 'center',
  },
  earningValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fbbf24',
  },
  earningLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  qualityLabel: {
    color: '#94a3b8',
    fontSize: 14,
    marginRight: 10,
  },
  qualityBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
  },
  qualityFill: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 4,
  },
  qualityValue: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 10,
    width: 40,
    textAlign: 'right',
  },
  refreshButton: {
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  refreshText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '500',
  },
  coinsDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginVertical: 16,
  },
  coinsValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fbbf24',
  },
  coinsLabel: {
    fontSize: 20,
    color: '#94a3b8',
    marginLeft: 8,
  },
  coinsHint: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 14,
  },
  adsContainer: {
    gap: 0,
  },
  bannerContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  rewardButton: {
    backgroundColor: '#7c3aed',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  rewardButtonDisabled: {
    backgroundColor: '#4c1d95',
    opacity: 0.7,
  },
  rewardButtonEmoji: {
    fontSize: 24,
  },
  rewardButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#1e3a5f',
    borderRadius: 16,
    padding: 20,
    margin: 16,
    marginBottom: 0,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#38bdf8',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#bae6fd',
    marginBottom: 12,
  },
  splitRow: {
    flexDirection: 'row',
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
    gap: 2,
  },
  splitBar: {
    height: '100%',
    borderRadius: 4,
  },
  splitLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  splitLabel: {
    color: '#94a3b8',
    fontSize: 12,
  },
  configCard: {
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 0,
  },
  configTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
  },
  configText: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 4,
  },
});
