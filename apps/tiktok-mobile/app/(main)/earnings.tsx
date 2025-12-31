/**
 * Earnings Screen
 * 
 * Shows DataClaus earnings with ad integration
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api, Earnings } from '../../services/api';

export default function EarningsScreen() {
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [coins, setCoins] = useState(0);

  const loadEarnings = useCallback(async () => {
    try {
      const data = await api.getEarnings();
      setEarnings(data);
    } catch (error) {
      console.log('Failed to load earnings');
    }
  }, []);

  useEffect(() => {
    loadEarnings();
  }, [loadEarnings]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadEarnings();
    setIsRefreshing(false);
  };

  const handleWatchAd = async () => {
    Alert.alert(
      '🎬 Watching Ad...',
      'Simulating rewarded ad...',
      [{ text: 'OK' }]
    );

    // Simulate ad revenue
    setTimeout(async () => {
      try {
        const result = await api.recordAdImpression('rewarded', 0.0025);
        setCoins(prev => prev + 50);
        
        Alert.alert(
          '🎉 Reward Earned!',
          `You earned 50 coins + $${result.userShare.toFixed(4)}!`
        );

        loadEarnings();
      } catch (error) {
        console.log('Ad impression failed');
      }
    }, 2000);
  };

  const handleWithdraw = () => {
    Alert.alert(
      'Withdraw',
      'Minimum withdrawal is $1.00. Your current balance will be sent to your connected wallet.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => Alert.alert('Success', 'Withdrawal request submitted!') },
      ]
    );
  };

  const qualityPercent = ((earnings?.qualityScore || 0) * 100).toFixed(0);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#fff" />
      }
    >
      {/* Header */}
      <LinearGradient
        colors={['#fe2c55', '#000']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Your Earnings</Text>
        <Text style={styles.totalAmount}>
          ${earnings?.totalEarned.toFixed(4) || '0.0000'}
        </Text>
        <Text style={styles.totalLabel}>Total Earned</Text>
      </LinearGradient>

      {/* Balance Cards */}
      <View style={styles.balanceCards}>
        <View style={styles.balanceCard}>
          <Ionicons name="time" size={24} color="#fbbf24" />
          <Text style={styles.balanceAmount}>
            ${earnings?.pendingBalance.toFixed(4) || '0.0000'}
          </Text>
          <Text style={styles.balanceLabel}>Pending</Text>
        </View>
        <View style={styles.balanceCard}>
          <Ionicons name="wallet" size={24} color="#22c55e" />
          <Text style={styles.balanceAmount}>
            ${earnings?.availableBalance.toFixed(4) || '0.0000'}
          </Text>
          <Text style={styles.balanceLabel}>Available</Text>
        </View>
      </View>

      {/* Quality Score */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quality Score</Text>
        <View style={styles.qualityCard}>
          <View style={styles.qualityHeader}>
            <Text style={styles.qualityValue}>{qualityPercent}%</Text>
            <Text style={styles.qualityHint}>Higher = More earnings</Text>
          </View>
          <View style={styles.qualityBar}>
            <View style={[styles.qualityFill, { width: `${qualityPercent}%` }]} />
          </View>
          <Text style={styles.qualityTip}>
            💡 Watch more videos and engage to increase your score
          </Text>
        </View>
      </View>

      {/* Coins */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>In-App Coins</Text>
        <View style={styles.coinsCard}>
          <View style={styles.coinsDisplay}>
            <Text style={styles.coinsEmoji}>🪙</Text>
            <Text style={styles.coinsValue}>{coins}</Text>
            <Text style={styles.coinsLabel}>coins</Text>
          </View>
          <TouchableOpacity style={styles.watchAdButton} onPress={handleWatchAd}>
            <Ionicons name="videocam" size={20} color="#fff" />
            <Text style={styles.watchAdText}>Watch Ad for 50 Coins</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Revenue Split */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How You Earn</Text>
        <View style={styles.splitCard}>
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
      </View>

      {/* Withdraw Button */}
      <TouchableOpacity 
        style={[
          styles.withdrawButton,
          (earnings?.availableBalance || 0) < 1 && styles.withdrawButtonDisabled,
        ]}
        onPress={handleWithdraw}
        disabled={(earnings?.availableBalance || 0) < 1}
      >
        <Text style={styles.withdrawButtonText}>Withdraw Funds</Text>
        <Text style={styles.withdrawHint}>Minimum $1.00</Text>
      </TouchableOpacity>

      {/* DataClaus Badge */}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Powered by DataClaus</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: 'center',
  },
  headerTitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  totalAmount: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '800',
    marginBottom: 4,
  },
  totalLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  balanceCards: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: -20,
    gap: 12,
  },
  balanceCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  balanceAmount: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  balanceLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  qualityCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
  },
  qualityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  qualityValue: {
    color: '#22c55e',
    fontSize: 28,
    fontWeight: '700',
  },
  qualityHint: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
  },
  qualityBar: {
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  qualityFill: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 4,
  },
  qualityTip: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
  },
  coinsCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
  },
  coinsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  coinsEmoji: {
    fontSize: 32,
  },
  coinsValue: {
    color: '#fbbf24',
    fontSize: 36,
    fontWeight: '800',
  },
  coinsLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
  },
  watchAdButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  watchAdText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  splitCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
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
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
  },
  withdrawButton: {
    margin: 16,
    backgroundColor: '#22c55e',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  withdrawButtonDisabled: {
    backgroundColor: '#333',
  },
  withdrawButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  withdrawHint: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 4,
  },
  badge: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 100,
  },
  badgeText: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 12,
  },
});
