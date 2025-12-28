/**
 * reCAPTCHA Demo Screen
 * =====================
 *
 * Demonstrates Google reCAPTCHA Enterprise integration with the DataClaus SDK.
 * Shows how to protect user actions and detect bots.
 *
 * USING REAL RECAPTCHA SDK!
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';

// Import the REAL Google reCAPTCHA Enterprise SDK
import {
  Recaptcha,
  RecaptchaAction,
  type RecaptchaClient,
} from '@google-cloud/recaptcha-enterprise-react-native';

// ============================================
// CONFIGURATION
// ============================================

// Get environment variables
const RECAPTCHA_SITE_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY_IOS,
  android: process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY_ANDROID,
  default: '',
});

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:4000';

// Get host IP for development
const getBackendUrl = () => {
  if (Platform.OS === 'web') return BACKEND_URL;

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:4000`;
  }

  return Platform.OS === 'android'
    ? 'http://10.0.2.2:4000'
    : 'http://localhost:4000';
};

// ============================================
// REAL RECAPTCHA HOOK
// ============================================

interface RecaptchaResult {
  isBot: boolean;
  score: number;
  reasons: string[];
  tokenValid: boolean;
  actionValid: boolean;
  token?: string;
}

function useRealRecaptcha(siteKey: string) {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const clientRef = useRef<RecaptchaClient | null>(null);

  // Initialize the reCAPTCHA client
  useEffect(() => {
    const initClient = async () => {
      if (!siteKey) {
        setInitError('No site key configured');
        return;
      }

      try {
        console.log(
          '[reCAPTCHA] Initializing with site key:',
          siteKey.substring(0, 10) + '...'
        );
        const client = await Recaptcha.fetchClient(siteKey);
        clientRef.current = client;
        setIsReady(true);
        setInitError(null);
        console.log('[reCAPTCHA] ✅ Client initialized successfully!');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('[reCAPTCHA] ❌ Init failed:', message);
        setInitError(message);
        setIsReady(false);
      }
    };

    initClient();
  }, [siteKey]);

  // Execute reCAPTCHA and get token
  const verifyAction = useCallback(
    async (action: string): Promise<RecaptchaResult> => {
      if (!clientRef.current) {
        throw new Error('reCAPTCHA client not initialized');
      }

      setIsLoading(true);
      setError(null);

      try {
        // Get the appropriate action
        let recaptchaAction;
        switch (action.toUpperCase()) {
          case 'LOGIN':
            recaptchaAction = RecaptchaAction.LOGIN();
            break;
          case 'SIGNUP':
            recaptchaAction = RecaptchaAction.SIGNUP();
            break;
          default:
            recaptchaAction = RecaptchaAction.custom(action.toUpperCase());
        }

        console.log('[reCAPTCHA] Executing action:', action);

        // Execute and get REAL token from Google
        const token = await clientRef.current.execute(recaptchaAction);
        console.log(
          '[reCAPTCHA] ✅ Got token:',
          token.substring(0, 20) + '...'
        );

        // Send token to backend for verification
        const response = await fetch(
          `${getBackendUrl()}/dataclaus/recaptcha/verify`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              token,
              action: action.toUpperCase(),
              timestamp: Date.now(),
              userId: 'real_user',
              deviceId: Platform.OS,
              isRealToken: true,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        console.log('[reCAPTCHA] Verification result:', result);

        return {
          isBot: result.isBot,
          score: result.score,
          reasons: result.reasons || [],
          tokenValid: result.tokenValid,
          actionValid: result.actionValid,
          token,
        };
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        console.error('[reCAPTCHA] ❌ Error:', error.message);
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    isReady,
    isLoading,
    error,
    initError,
    verifyAction,
    clearError: () => setError(null),
  };
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function RecaptchaScreen() {
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Results state
  const [lastResult, setLastResult] = useState<RecaptchaResult | null>(null);
  const [actionType, setActionType] = useState<
    'login' | 'signup' | 'checkout' | 'custom'
  >('login');

  // Use REAL reCAPTCHA hook!
  const { isReady, isLoading, error, initError, verifyAction, clearError } =
    useRealRecaptcha(RECAPTCHA_SITE_KEY || '');

  // Handle verification
  const handleVerify = async (action: string) => {
    clearError();
    setLastResult(null);

    try {
      const result = await verifyAction(action);
      setLastResult(result);

      if (result.isBot) {
        Alert.alert(
          '🤖 Bot Detected',
          `Score: ${result.score.toFixed(
            2
          )}\n\nThis action was flagged as suspicious.\n\nReasons: ${
            result.reasons.join(', ') || 'Low score'
          }`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          '✅ Human Verified',
          `Score: ${result.score.toFixed(2)}\n\nYou passed the security check!`,
          [{ text: 'Continue' }]
        );
      }
    } catch (err) {
      Alert.alert(
        'Error',
        `Verification failed: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`
      );
    }
  };

  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 0.7) return '#22c55e';
    if (score >= 0.5) return '#eab308';
    return '#ef4444';
  };

  return (
    <ScrollView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>🛡️</Text>
        <Text style={styles.title}>reCAPTCHA Enterprise</Text>
        <Text style={styles.subtitle}>
          Protect your app from bots and abuse
        </Text>
        {!isReady && initError && (
          <View style={[styles.demoBadge, { backgroundColor: '#ef444433' }]}>
            <Text style={[styles.demoBadgeText, { color: '#ef4444' }]}>
              {initError}
            </Text>
          </View>
        )}
        {isReady && (
          <View style={[styles.demoBadge, { backgroundColor: '#22c55e33' }]}>
            <Text style={[styles.demoBadgeText, { color: '#22c55e' }]}>
              ✅ Real reCAPTCHA Active
            </Text>
          </View>
        )}
      </View>

      {/* Setup Status */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📋 Setup Status</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Platform:</Text>
          <Text style={styles.statusValue}>{Platform.OS}</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Site Key:</Text>
          <Text style={styles.statusValue}>
            {RECAPTCHA_SITE_KEY
              ? `${RECAPTCHA_SITE_KEY.substring(0, 10)}...`
              : '❌ Not configured'}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Backend:</Text>
          <Text style={styles.statusValue}>{getBackendUrl()}</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Status:</Text>
          <Text
            style={[
              styles.statusValue,
              { color: isReady ? '#22c55e' : '#ef4444' },
            ]}
          >
            {isReady ? '✓ Ready' : '✗ Not Ready'}
          </Text>
        </View>
      </View>

      {/* Demo Login Form */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔐 Protected Login</Text>
        <Text style={styles.cardDescription}>
          Try logging in to see reCAPTCHA verification in action
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#64748b"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#64748b"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.loginButton, isLoading && styles.buttonDisabled]}
          onPress={() => handleVerify('LOGIN')}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.loginButtonText}>Login with reCAPTCHA</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Action Buttons */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎯 Test Actions</Text>
        <Text style={styles.cardDescription}>
          reCAPTCHA supports different actions for different user flows
        </Text>

        <View style={styles.actionGrid}>
          {(['login', 'signup', 'checkout', 'custom'] as const).map(
            (action) => (
              <TouchableOpacity
                key={action}
                style={[
                  styles.actionButton,
                  actionType === action && styles.actionButtonActive,
                ]}
                onPress={() => setActionType(action)}
              >
                <Text
                  style={[
                    styles.actionButtonText,
                    actionType === action && styles.actionButtonTextActive,
                  ]}
                >
                  {action.toUpperCase()}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>

        <TouchableOpacity
          style={[styles.verifyButton, isLoading && styles.buttonDisabled]}
          onPress={() => handleVerify(actionType.toUpperCase())}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.verifyButtonText}>
              🔍 Verify {actionType.toUpperCase()} Action
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Results Card */}
      {lastResult && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📊 Verification Result</Text>

          <View style={styles.scoreContainer}>
            <Text
              style={[
                styles.scoreValue,
                { color: getScoreColor(lastResult.score) },
              ]}
            >
              {(lastResult.score * 100).toFixed(0)}%
            </Text>
            <Text style={styles.scoreLabel}>Trust Score</Text>
          </View>

          <View style={styles.resultBadges}>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: lastResult.isBot ? '#ef444433' : '#22c55e33',
                },
              ]}
            >
              <Text style={styles.badgeText}>
                {lastResult.isBot ? '🤖 Bot Detected' : '👤 Human'}
              </Text>
            </View>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: lastResult.tokenValid
                    ? '#22c55e33'
                    : '#ef444433',
                },
              ]}
            >
              <Text style={styles.badgeText}>
                {lastResult.tokenValid ? '✓ Token Valid' : '✗ Token Invalid'}
              </Text>
            </View>
          </View>

          {lastResult.reasons.length > 0 && (
            <View style={styles.reasonsContainer}>
              <Text style={styles.reasonsTitle}>Reasons:</Text>
              {lastResult.reasons.map((reason, index) => (
                <Text key={index} style={styles.reasonText}>
                  • {reason}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Error Card */}
      {error && (
        <View style={[styles.card, styles.errorCard]}>
          <Text style={styles.errorTitle}>❌ Error</Text>
          <Text style={styles.errorText}>{error.message}</Text>
          <TouchableOpacity style={styles.clearButton} onPress={clearError}>
            <Text style={styles.clearButtonText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>📖 How It Works</Text>
        <Text style={styles.infoText}>
          1️⃣ <Text style={styles.bold}>Token Generation</Text>: The SDK
          generates a cryptographic token on the device{'\n\n'}
          2️⃣ <Text style={styles.bold}>Backend Verification</Text>: Token is
          sent to your backend for validation{'\n\n'}
          3️⃣ <Text style={styles.bold}>Risk Assessment</Text>: Google analyzes
          device signals and returns a score (0.0-1.0){'\n\n'}
          4️⃣ <Text style={styles.bold}>Decision</Text>: Your app decides whether
          to allow, challenge, or block the action
        </Text>
      </View>

      {/* Setup Instructions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚙️ Setup Required</Text>
        <Text style={styles.cardDescription}>
          To use real reCAPTCHA verification, you need:
        </Text>
        <View style={styles.setupList}>
          <Text style={styles.setupItem}>
            1. Google Cloud Project with reCAPTCHA Enterprise API enabled
          </Text>
          <Text style={styles.setupItem}>
            2. reCAPTCHA Site Key for iOS and/or Android
          </Text>
          <Text style={styles.setupItem}>
            3. Service Account for backend verification
          </Text>
          <Text style={styles.setupItem}>
            4. Environment variables configured
          </Text>
        </View>
        <Text style={styles.setupFooter}>
          See <Text style={styles.link}>docs/recaptcha-setup.md</Text> for
          detailed instructions
        </Text>
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
    fontSize: 24,
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
  demoBadge: {
    marginTop: 12,
    backgroundColor: '#f59e0b33',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  demoBadgeText: {
    color: '#f59e0b',
    fontSize: 12,
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
  cardDescription: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  statusLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  statusValue: {
    fontSize: 14,
    color: '#f8fafc',
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    color: '#f8fafc',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  loginButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
  },
  actionButtonActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#3b82f633',
  },
  actionButtonText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  actionButtonTextActive: {
    color: '#3b82f6',
  },
  verifyButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scoreContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  scoreLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  resultBadges: {
    flexDirection: 'row',
    justifyContent: 'center',
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
  reasonsContainer: {
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 8,
  },
  reasonsTitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 12,
    color: '#f8fafc',
  },
  errorCard: {
    borderColor: '#ef4444',
    borderWidth: 1,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#fca5a5',
    marginBottom: 12,
  },
  clearButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#334155',
  },
  clearButtonText: {
    fontSize: 12,
    color: '#f8fafc',
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
    marginBottom: 12,
  },
  infoText: {
    fontSize: 13,
    color: '#bae6fd',
    lineHeight: 22,
  },
  bold: {
    fontWeight: '600',
  },
  setupList: {
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  setupItem: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 8,
  },
  setupFooter: {
    fontSize: 12,
    color: '#64748b',
  },
  link: {
    color: '#3b82f6',
    textDecorationLine: 'underline',
  },
});
