/**
 * Profile Setup Screen
 * 
 * For new users to set their username
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { user, updateProfile } = useAuth();
  
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleComplete = async () => {
    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await updateProfile({ username: `@${username.replace('@', '')}` });
      router.replace('/(main)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    router.replace('/(main)');
  };

  return (
    <View style={styles.container}>
      {/* Skip */}
      <TouchableOpacity style={styles.skip} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Set up your profile</Text>
        <Text style={styles.subtitle}>Choose a unique username</Text>

        {/* Avatar */}
        <TouchableOpacity style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color="#666" />
          </View>
          <View style={styles.avatarBadge}>
            <Ionicons name="camera" size={16} color="#fff" />
          </View>
        </TouchableOpacity>

        {/* Username Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputPrefix}>@</Text>
          <TextInput
            style={styles.input}
            placeholder="username"
            placeholderTextColor="#666"
            value={username}
            onChangeText={(text) => {
              setUsername(text.toLowerCase().replace(/[^a-z0-9_]/g, ''));
              setError('');
            }}
            autoCapitalize="none"
            maxLength={20}
            autoFocus
          />
        </View>

        <Text style={styles.hint}>
          Only letters, numbers, and underscores
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Complete Button */}
        <TouchableOpacity
          style={[
            styles.button,
            username.length < 3 && styles.buttonDisabled,
          ]}
          onPress={handleComplete}
          disabled={username.length < 3 || isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Complete Setup</Text>
          )}
        </TouchableOpacity>

        {/* DataClaus Info */}
        <View style={styles.info}>
          <Ionicons name="wallet" size={24} color="#25f4ee" />
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>Wallet Created!</Text>
            <Text style={styles.infoDesc}>
              Your DataClaus wallet is ready. Start earning!
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  skip: {
    position: 'absolute',
    top: 60,
    right: 16,
    zIndex: 10,
    padding: 8,
  },
  skipText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 120,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 32,
    textAlign: 'center',
  },
  avatarContainer: {
    marginBottom: 32,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fe2c55',
    alignItems: 'center',
    justifyContent: 'center',
      borderWidth: 3,
    borderColor: '#000',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    width: '100%',
  },
  inputPrefix: {
    color: '#666',
    fontSize: 20,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 20,
    paddingVertical: 16,
    fontWeight: '600',
  },
  hint: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 14,
    marginBottom: 16,
  },
  error: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#fe2c55',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    marginBottom: 32,
  },
  buttonDisabled: {
    backgroundColor: '#3a3a3a',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(37, 244, 238, 0.1)',
    padding: 16,
    borderRadius: 12,
    width: '100%',
    gap: 12,
  },
  infoText: {
    flex: 1,
  },
  infoTitle: {
    color: '#25f4ee',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoDesc: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
});
