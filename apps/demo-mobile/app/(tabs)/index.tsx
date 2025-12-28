/**
 * DataClaus Demo Mobile App
 *
 * This app uses the @dataclaus/sdk-react-native to collect
 * real sensor data and send it to the developer's backend.
 *
 * Flow: This App (SDK) -> Developer Backend -> DataClaus API
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { Accelerometer, Gyroscope } from 'expo-sensors';

// Import DataClaus SDK
// Note: The SDK provides hooks and classes for data collection
// We use the DataClausCollector class directly for more control
import { DataClausCollector } from '@dataclaus/sdk-react-native';

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

interface SessionInfo {
  sessionId: string;
  startTime: string;
  activeSeconds: number;
  eventsCollected: number;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function HomeScreen() {
  // SDK Collector reference
  const collectorRef = useRef<DataClausCollector | null>(null);

  // State
  const [isCollecting, setIsCollecting] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({
    sessionId: '',
    startTime: '',
    activeSeconds: 0,
    eventsCollected: 0,
  });
  const [accelData, setAccelData] = useState<SensorData>({ x: 0, y: 0, z: 0 });
  const [gyroData, setGyroData] = useState<SensorData>({ x: 0, y: 0, z: 0 });
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connected' | 'error'
  >('disconnected');
  const [lastFlushTime, setLastFlushTime] = useState<string>('Never');
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [useRealSensors, setUseRealSensors] = useState(true);

  // Initialize SDK Collector
  useEffect(() => {
    collectorRef.current = new DataClausCollector({
      backendUrl: BACKEND_URL,
      userId: USER_ID,
      collectionInterval: 100,
      batchSize: 20,
      flushInterval: 3000,
      debug: true,
    });

    return () => {
      collectorRef.current?.stop();
    };
  }, []);

  // Real sensor subscriptions
  useEffect(() => {
    if (!isCollecting || !useRealSensors) return;

    let accelSubscription: { remove: () => void } | null = null;
    let gyroSubscription: { remove: () => void } | null = null;

    // Setup accelerometer
    Accelerometer.setUpdateInterval(100);
    accelSubscription = Accelerometer.addListener((data) => {
      setAccelData(data);
      collectorRef.current?.trackAccelerometer(data);
    });

    // Setup gyroscope
    Gyroscope.setUpdateInterval(100);
    gyroSubscription = Gyroscope.addListener((data) => {
      setGyroData(data);
      collectorRef.current?.trackGyroscope(data);
    });

    return () => {
      accelSubscription?.remove();
      gyroSubscription?.remove();
    };
  }, [isCollecting, useRealSensors]);

  // Simulated sensor data (fallback for web/emulator without sensors)
  useEffect(() => {
    if (!isCollecting || useRealSensors) return;

    const interval = setInterval(() => {
      const simulatedAccel = {
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2,
        z: 9.8 + (Math.random() - 0.5) * 0.5,
      };
      const simulatedGyro = {
        x: (Math.random() - 0.5) * 0.5,
        y: (Math.random() - 0.5) * 0.5,
        z: (Math.random() - 0.5) * 0.5,
      };

      setAccelData(simulatedAccel);
      setGyroData(simulatedGyro);
      collectorRef.current?.trackAccelerometer(simulatedAccel);
      collectorRef.current?.trackGyroscope(simulatedGyro);
    }, 100);

    return () => clearInterval(interval);
  }, [isCollecting, useRealSensors]);

  // Session timer
  useEffect(() => {
    if (!isCollecting) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const info = collectorRef.current?.getSessionInfo();
      setSessionInfo({
        sessionId: info?.sessionId || '',
        startTime: info?.startTime || '',
        activeSeconds: Math.floor((Date.now() - startTime) / 1000),
        eventsCollected: info?.screenViews || 0,
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isCollecting]);

  // Fetch quality score
  const fetchEarnings = async () => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/dataclaus/earnings/${USER_ID}`
      );
      if (response.ok) {
        const data = await response.json();
        setQualityScore(data.quality_score);
        setConnectionStatus('connected');
        Alert.alert(
          'Analysis Complete',
          `Your data Quality Score is: ${
            data.quality_score?.toFixed(2) || 'Calculating...'
          }`
        );
      } else {
        console.error('Failed to fetch earnings');
      }
    } catch (error) {
      console.error('Error fetching earnings:', error);
    }
  };

  // Toggle collection
  const toggleCollection = useCallback(() => {
    if (isCollecting) {
      // Stop collection
      collectorRef.current?.stop();
      setIsCollecting(false);
      setLastFlushTime(new Date().toLocaleTimeString());

      Alert.alert(
        'Recording Stopped 🛑',
        `Session Summary:\n\n⏱️ Duration: ${sessionInfo.activeSeconds}s\n📦 Events collected\n\nData has been sent for analysis.`,
        [
          { text: 'Close', style: 'cancel' },
          { text: 'Check Quality Score', onPress: fetchEarnings },
        ]
      );
    } else {
      // Start collection
      collectorRef.current?.start();
      setIsCollecting(true);
      setQualityScore(null);
      setSessionInfo({
        sessionId: collectorRef.current?.getSessionId() || '',
        startTime: new Date().toISOString(),
        activeSeconds: 0,
        eventsCollected: 0,
      });
    }
  }, [isCollecting, sessionInfo.activeSeconds]);

  // Test connection
  const testConnection = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      if (response.ok) {
        const data = await response.json();
        Alert.alert(
          'Success ✅',
          `Connected to backend!\nSDK Enabled: ${
            data.sdkEnabled ? 'Yes' : 'No'
          }`
        );
        setConnectionStatus('connected');
      } else {
        Alert.alert('Error', 'Backend returned an error');
        setConnectionStatus('error');
      }
    } catch (error) {
      Alert.alert(
        'Error',
        'Cannot connect to backend. Make sure it is running.'
      );
      setConnectionStatus('error');
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <ScrollView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}></Text>
        <Text style={styles.title}>DataClaus SDK Demo</Text>
        <Text style={styles.subtitle}>Real Sensor Data Collection</Text>
        <Text style={styles.sdkBadge}>
          Powered by @dataclaus/sdk-react-native
        </Text>
      </View>

      {/* Connection Status */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Connection Status</Text>
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
              ? 'Connection Error'
              : 'Not Connected'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={testConnection}
        >
          <Text style={styles.secondaryButtonText}>Test Connection</Text>
        </TouchableOpacity>
      </View>

      {/* Sensor Mode Toggle */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sensor Mode</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              useRealSensors && styles.modeButtonActive,
            ]}
            onPress={() => setUseRealSensors(true)}
          >
            <Text style={styles.modeButtonText}>📱 Real Sensors</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeButton,
              !useRealSensors && styles.modeButtonActive,
            ]}
            onPress={() => setUseRealSensors(false)}
          >
            <Text style={styles.modeButtonText}>🎲 Simulated</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Session Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Session Info</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoValue}>{sessionInfo.activeSeconds}s</Text>
            <Text style={styles.infoLabel}>Duration</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoValue}>{lastFlushTime}</Text>
            <Text style={styles.infoLabel}>Last Sync</Text>
          </View>
        </View>
      </View>

      {/* Quality Score Card */}
      {qualityScore !== null && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💎 Data Quality Score</Text>
          <View style={{ alignItems: 'center', padding: 10 }}>
            <Text
              style={{ fontSize: 48, fontWeight: 'bold', color: '#fbbf24' }}
            >
              {qualityScore.toFixed(2)}
            </Text>
            <Text style={{ color: '#94a3b8', marginTop: 5 }}>
              (Higher score = Higher earnings)
            </Text>
          </View>
        </View>
      )}

      {/* Sensor Data */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📊 Accelerometer</Text>
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

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔄 Gyroscope</Text>
        <View style={styles.sensorGrid}>
          <View style={styles.sensorItem}>
            <Text style={styles.sensorLabel}>X</Text>
            <Text style={styles.sensorValue}>{gyroData.x.toFixed(3)}</Text>
          </View>
          <View style={styles.sensorItem}>
            <Text style={styles.sensorLabel}>Y</Text>
            <Text style={styles.sensorValue}>{gyroData.y.toFixed(3)}</Text>
          </View>
          <View style={styles.sensorItem}>
            <Text style={styles.sensorLabel}>Z</Text>
            <Text style={styles.sensorValue}>{gyroData.z.toFixed(3)}</Text>
          </View>
        </View>
      </View>

      {/* Control Button */}
      <TouchableOpacity
        style={[styles.mainButton, isCollecting && styles.mainButtonActive]}
        onPress={toggleCollection}
      >
        <Text style={styles.mainButtonText}>
          {isCollecting ? '⏹ Stop Collection' : '▶ Start Collection'}
        </Text>
      </TouchableOpacity>

      {/* Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>📦 SDK Pipeline</Text>
        <Text style={styles.infoCardText}>
          1. SDK collects real sensor data{'\n'}
          2. Data is batched and sent to your backend{'\n'}
          3. Backend uses SDK to sign with HMAC{'\n'}
          4. DataClaus API receives and queues data{'\n'}
          5. Python AI Worker scores your data{'\n'}
          6. You earn based on quality! 💰
        </Text>
      </View>

      {/* Config Display */}
      <View style={styles.configCard}>
        <Text style={styles.configTitle}>Configuration</Text>
        <Text style={styles.configText}>Backend: {BACKEND_URL}</Text>
        <Text style={styles.configText}>
          User ID: {USER_ID.substring(0, 15)}...
        </Text>
        <Text style={styles.configText}>SDK: @dataclaus/sdk-react-native</Text>
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
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#22c55e',
    borderRadius: 12,
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
  secondaryButton: {
    backgroundColor: '#334155',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '500',
  },
  modeButton: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#3b82f6',
  },
  modeButtonText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '500',
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  infoItem: {
    alignItems: 'center',
    flex: 1,
  },
  infoValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#22d3ee',
  },
  infoLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
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
    marginTop: 24,
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  mainButtonActive: {
    backgroundColor: '#ef4444',
  },
  mainButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
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
    fontSize: 14,
    color: '#bae6fd',
    lineHeight: 22,
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
