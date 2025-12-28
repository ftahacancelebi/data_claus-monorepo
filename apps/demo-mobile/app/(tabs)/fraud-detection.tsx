/**
 * DataClaus Fraud Detection Demo Component
 * =========================================
 *
 * This component demonstrates the full fraud detection system with:
 * - Adaptive data collection based on activity
 * - Real-time fraud signal analysis
 * - Visual feedback for all metrics
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  Animated,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { Accelerometer, Gyroscope, Pedometer } from 'expo-sensors';

// Import SDK with Fraud Detection
import {
  useFraudDetection,
  type FraudSignal,
  type ActivityState,
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
const USER_ID = 'demo_user_' + Date.now().toString(36);

// ============================================
// TYPES
// ============================================

interface SensorData {
  x: number;
  y: number;
  z: number;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

const getSeverityColor = (severity: string): string => {
  switch (severity) {
    case 'critical':
      return '#ef4444';
    case 'high':
      return '#f97316';
    case 'medium':
      return '#eab308';
    case 'low':
      return '#22c55e';
    default:
      return '#64748b';
  }
};

const getActivityEmoji = (state: ActivityState): string => {
  switch (state) {
    case 'stationary':
      return '🛋️';
    case 'micro_motion':
      return '📱';
    case 'walking':
      return '🚶';
    case 'running':
      return '🏃';
    case 'vehicle':
      return '🚗';
    default:
      return '❓';
  }
};

const getQualityScoreColor = (score: number): string => {
  if (score >= 0.7) return '#22c55e'; // High quality
  if (score >= 0.4) return '#eab308'; // Medium quality
  return '#ef4444'; // Low quality
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function FraudDetectionScreen() {
  // Fraud Detection Hook
  const {
    state: fraudState,
    metrics,
    start: startFraudDetection,
    stop: stopFraudDetection,
    analyze,
    reset,
    canAnalyze,
  } = useFraudDetection(
    {
      Accelerometer,
      Gyroscope,
      Pedometer,
    },
    {
      debug: true,
      minCollectionTime: 5000,
      baseSampleRate: 50,
      minSamplesForAnalysis: 100,
    }
  );

  // Local State
  const [accelData, setAccelData] = useState<SensorData>({ x: 0, y: 0, z: 0 });
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connected' | 'error'
  >('disconnected');

  // Animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation during collection
  useEffect(() => {
    if (fraudState.isCollecting) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [fraudState.isCollecting, pulseAnim]);

  // Monitor accelerometer for display
  useEffect(() => {
    if (!fraudState.isCollecting) return;

    Accelerometer.setUpdateInterval(100);
    const subscription = Accelerometer.addListener((data) => {
      setAccelData(data);
    });

    return () => subscription.remove();
  }, [fraudState.isCollecting]);

  // Test connection
  const testConnection = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      if (response.ok) {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('error');
      }
    } catch {
      setConnectionStatus('error');
    }
  };

  // Handle stop and analyze
  const handleStopAndAnalyze = useCallback(async () => {
    setAnalysisRunning(true);
    try {
      await stopFraudDetection();
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setAnalysisRunning(false);
    }
  }, [stopFraudDetection]);

  // Handle peek analyze (without stopping)
  const handlePeekAnalyze = useCallback(async () => {
    setAnalysisRunning(true);
    try {
      await analyze();
    } catch (error) {
      console.error('Peek analysis error:', error);
    } finally {
      setAnalysisRunning(false);
    }
  }, [analyze]);

  // Send data to backend
  const sendToBackend = useCallback(async () => {
    if (!metrics) return;

    try {
      const response = await fetch(`${BACKEND_URL}/dataclaus/fraud-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: USER_ID,
          metrics,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        setConnectionStatus('connected');
      }
    } catch (error) {
      console.error('Failed to send fraud report:', error);
    }
  }, [metrics]);

  // ============================================
  // RENDER
  // ============================================

  return (
    <ScrollView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>🔍</Text>
        <Text style={styles.title}>Fraud Detection</Text>
        <Text style={styles.subtitle}>
          Adaptive Sensor Analysis for Fraud Prevention
        </Text>
      </View>

      {/* Activity State Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎯 Current Activity</Text>
        <Animated.View
          style={[styles.activityBadge, { transform: [{ scale: pulseAnim }] }]}
        >
          <Text style={styles.activityEmoji}>
            {getActivityEmoji(fraudState.activityState)}
          </Text>
          <Text style={styles.activityText}>
            {fraudState.activityState.replace('_', ' ').toUpperCase()}
          </Text>
        </Animated.View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{fraudState.samplesCollected}</Text>
            <Text style={styles.statLabel}>Samples</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {Math.round(fraudState.sampleRate)}Hz
            </Text>
            <Text style={styles.statLabel}>Sample Rate</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {Math.round(fraudState.collectionDuration / 1000)}s
            </Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View
            style={[
              styles.progressBar,
              { width: `${fraudState.progress * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {Math.round(fraudState.progress * 100)}% of minimum samples collected
        </Text>
      </View>

      {/* Live Sensor Display */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📊 Accelerometer (Live)</Text>
        <View style={styles.sensorGrid}>
          <View style={styles.sensorItem}>
            <Text style={styles.sensorLabel}>X</Text>
            <Text style={styles.sensorValue}>{accelData.x.toFixed(3)}</Text>
          </View>
          <View style={styles.sensorItem}>
            <Text style={styles.sensorLabel}>Y</Text>
            <Text style={styles.sensorValue}>{accelData.y.toFixed(3)}</Text>
          </View>
          <View style={styles.sensorItem}>
            <Text style={styles.sensorLabel}>Z</Text>
            <Text style={styles.sensorValue}>{accelData.z.toFixed(3)}</Text>
          </View>
        </View>
      </View>

      {/* Main Control Button */}
      <TouchableOpacity
        style={[
          styles.mainButton,
          fraudState.isCollecting && styles.mainButtonActive,
        ]}
        onPress={
          fraudState.isCollecting ? handleStopAndAnalyze : startFraudDetection
        }
        disabled={analysisRunning}
      >
        <Text style={styles.mainButtonText}>
          {analysisRunning
            ? '⏳ Analyzing...'
            : fraudState.isCollecting
            ? '⏹ Stop & Analyze'
            : '▶ Start Collection'}
        </Text>
      </TouchableOpacity>

      {/* Peek Analyze Button */}
      {fraudState.isCollecting && canAnalyze && (
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handlePeekAnalyze}
          disabled={analysisRunning}
        >
          <Text style={styles.secondaryButtonText}>
            👁️ Preview Analysis (without stopping)
          </Text>
        </TouchableOpacity>
      )}

      {/* Results Card */}
      {metrics && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 Analysis Results</Text>

          {/* Score Summary */}
          <View style={styles.scoreRow}>
            <View style={styles.scoreItem}>
              <Text
                style={[
                  styles.scoreValue,
                  { color: getQualityScoreColor(metrics.fraudScore) },
                ]}
              >
                {(metrics.fraudScore * 100).toFixed(0)}%
              </Text>
              <Text style={styles.scoreLabel}>Fraud Risk</Text>
            </View>
            <View style={styles.scoreItem}>
              <Text
                style={[
                  styles.scoreValue,
                  {
                    color: getQualityScoreColor(1 - metrics.deviceConfidence),
                  },
                ]}
              >
                {(metrics.deviceConfidence * 100).toFixed(0)}%
              </Text>
              <Text style={styles.scoreLabel}>Device Trust</Text>
            </View>
          </View>

          {/* Status Badges */}
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: metrics.isEmulator
                    ? '#ef444433'
                    : '#22c55e33',
                },
              ]}
            >
              <Text style={styles.badgeText}>
                {metrics.isEmulator ? '🤖 Emulator' : '📱 Real Device'}
              </Text>
            </View>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: metrics.motionPatterns.isHumanLike
                    ? '#22c55e33'
                    : '#ef444433',
                },
              ]}
            >
              <Text style={styles.badgeText}>
                {metrics.motionPatterns.isHumanLike
                  ? '👤 Human Motion'
                  : '🤖 Suspicious Motion'}
              </Text>
            </View>
          </View>

          {/* Motion Details */}
          <View style={styles.detailsSection}>
            <Text style={styles.detailsTitle}>Motion Analysis</Text>
            <Text style={styles.detailsText}>
              Magnitude: {metrics.motionPatterns.avgMagnitude.toFixed(2)} m/s²
            </Text>
            <Text style={styles.detailsText}>
              Variance: {metrics.motionPatterns.variance.toFixed(4)}
            </Text>
            <Text style={styles.detailsText}>
              Jitter: {metrics.motionPatterns.jitter.toFixed(4)}
            </Text>
            <Text style={styles.detailsText}>
              Samples: {metrics.motionPatterns.samples}
            </Text>
          </View>

          {/* Battery Analysis */}
          {metrics.battery && (
            <View style={styles.detailsSection}>
              <Text style={styles.detailsTitle}>Battery Analysis</Text>
              <Text style={styles.detailsText}>
                Level: {metrics.battery.level.toFixed(0)}%
              </Text>
              <Text style={styles.detailsText}>
                Charging: {metrics.battery.isCharging ? 'Yes' : 'No'}
              </Text>
              <Text style={styles.detailsText}>
                Simulated:{' '}
                <Text
                  style={{
                    color: metrics.battery.isSimulated ? '#ef4444' : '#22c55e',
                  }}
                >
                  {metrics.battery.isSimulated ? 'Likely' : 'No'}
                </Text>
              </Text>
            </View>
          )}

          {/* Fraud Signals */}
          {metrics.fraudSignals.length > 0 && (
            <View style={styles.detailsSection}>
              <Text style={styles.detailsTitle}>
                ⚠️ Fraud Signals ({metrics.fraudSignals.length})
              </Text>
              {metrics.fraudSignals.map(
                (signal: FraudSignal, index: number) => (
                  <View key={index} style={styles.signalItem}>
                    <View
                      style={[
                        styles.signalDot,
                        { backgroundColor: getSeverityColor(signal.severity) },
                      ]}
                    />
                    <Text style={styles.signalText}>
                      {signal.type.replace(/_/g, ' ')}
                    </Text>
                    <Text style={styles.signalScore}>
                      {(signal.score * 100).toFixed(0)}%
                    </Text>
                  </View>
                )
              )}
            </View>
          )}

          {/* Send to Backend */}
          <TouchableOpacity style={styles.sendButton} onPress={sendToBackend}>
            <Text style={styles.sendButtonText}>📤 Send Report to Backend</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Connection Status */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔌 Connection</Text>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  connectionStatus === 'connected'
                    ? '#22c55e'
                    : connectionStatus === 'error'
                    ? '#ef4444'
                    : '#6b7280',
              },
            ]}
          />
          <Text style={styles.statusText}>
            {connectionStatus === 'connected'
              ? 'Connected'
              : connectionStatus === 'error'
              ? 'Error'
              : 'Disconnected'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.connectionButton}
          onPress={testConnection}
        >
          <Text style={styles.connectionButtonText}>Test Connection</Text>
        </TouchableOpacity>
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>📖 How It Works</Text>
        <Text style={styles.infoCardText}>
          This fraud detection system uses{' '}
          <Text style={{ fontWeight: 'bold' }}>adaptive collection</Text> to
          handle different activity levels:{'\n\n'}
          🛋️ <Text style={{ fontWeight: '600' }}>Stationary</Text>: Reduces
          sampling to save battery{'\n'}
          🚶 <Text style={{ fontWeight: '600' }}>Walking</Text>: Normal sampling
          with step detection{'\n'}
          🏃 <Text style={{ fontWeight: '600' }}>Running</Text>: Increased
          sampling for patterns{'\n'}
          🚗 <Text style={{ fontWeight: '600' }}>Vehicle</Text>: Detects
          non-walking motion{'\n\n'}
          The system cross-validates multiple signals to detect fraud attempts.
        </Text>
      </View>

      {/* Reset Button */}
      <TouchableOpacity style={styles.resetButton} onPress={reset}>
        <Text style={styles.resetButtonText}>🔄 Reset Session</Text>
      </TouchableOpacity>

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
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 5,
    textAlign: 'center',
    paddingHorizontal: 20,
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
    marginBottom: 16,
  },
  activityBadge: {
    alignItems: 'center',
    backgroundColor: '#334155',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  activityEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  activityText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f8fafc',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#22d3ee',
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  progressContainer: {
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  sensorGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  sensorItem: {
    alignItems: 'center',
    backgroundColor: '#334155',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  sensorLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 4,
  },
  sensorValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#22d3ee',
    fontVariant: ['tabular-nums'],
  },
  mainButton: {
    backgroundColor: '#22c55e',
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  mainButtonActive: {
    backgroundColor: '#ef4444',
  },
  mainButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#334155',
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '500',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  scoreItem: {
    alignItems: 'center',
    flex: 1,
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  scoreLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    color: '#f8fafc',
    fontWeight: '500',
  },
  detailsSection: {
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: 8,
  },
  detailsText: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  signalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  signalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  signalText: {
    flex: 1,
    fontSize: 12,
    color: '#e2e8f0',
    textTransform: 'capitalize',
  },
  signalScore: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  sendButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
  connectionButton: {
    backgroundColor: '#334155',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  connectionButtonText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '500',
  },
  infoCard: {
    backgroundColor: '#1e3a5f',
    borderRadius: 16,
    padding: 20,
    margin: 16,
    marginBottom: 0,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#38bdf8',
    marginBottom: 12,
  },
  infoCardText: {
    fontSize: 13,
    color: '#bae6fd',
    lineHeight: 22,
  },
  resetButton: {
    backgroundColor: '#334155',
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
});
