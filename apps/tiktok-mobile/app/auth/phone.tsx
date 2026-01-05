/**
 * Phone Input Screen - DataClaus Authentication
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';

export default function PhoneScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleContinue = async () => {
    if (phone.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await api.requestOtp(phone);
      
      // Navigate to OTP screen with phone and dev OTP (if available)
      router.push({
        pathname: '/auth/otp',
        params: { phone, devOtp: result.otp || '' },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={28} color="#fff" />
      </TouchableOpacity>

      <View style={styles.content}>
        {/* DataClaus Logo */}
        <View style={styles.logoSection}>
          <View style={styles.dataclausLogo}>
            <Ionicons name="shield-checkmark" size={40} color="#25f4ee" />
          </View>
          <Text style={styles.dataclausTitle}>DataClaus</Text>
          <Text style={styles.dataclausSubtitle}>Universal Identity</Text>
        </View>

        <Text style={styles.title}>Sign in with phone</Text>
        <Text style={styles.subtitle}>
          One account for all DataClaus apps. Your data, your earnings.
        </Text>

        {/* Phone Input */}
        <View style={styles.inputContainer}>
          <View style={styles.countryCode}>
            <Text style={styles.countryCodeText}>+90</Text>
            <Ionicons name="chevron-down" size={16} color="#888" />
          </View>
          <TextInput
            style={styles.input}
            placeholder="555 123 4567"
            placeholderTextColor="#666"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={(text) => {
              setPhone(text.replace(/\D/g, ''));
              setError('');
            }}
            maxLength={10}
            autoFocus
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Continue Button */}
        <TouchableOpacity
          style={[
            styles.button,
            phone.length < 10 && styles.buttonDisabled,
          ]}
          onPress={handleContinue}
          disabled={phone.length < 10 || isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </TouchableOpacity>

        {/* Info */}
        <View style={styles.infoCard}>
          <Ionicons name="sparkles" size={20} color="#25f4ee" />
          <Text style={styles.infoText}>
            Earn money from your data across all apps using DataClaus authentication
          </Text>
        </View>

        <View style={styles.footer}>
          <Ionicons name="shield-checkmark" size={16} color="#22c55e" />
          <Text style={styles.footerText}>
            Protected by reCAPTCHA Enterprise
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  back: {
    position: 'absolute',
    top: 60,
    left: 16,
    zIndex: 10,
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 100,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  dataclausLogo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: 'rgba(37, 244, 238, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  dataclausTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#25f4ee',
  },
  dataclausSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 24,
    lineHeight: 22,
  },
  inputContainer: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRightWidth: 1,
    borderRightColor: '#333',
    gap: 4,
  },
  countryCodeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    padding: 16,
    fontWeight: '500',
  },
  error: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#25f4ee',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: '#3a3a3a',
  },
  buttonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(37, 244, 238, 0.1)',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
  },
});

