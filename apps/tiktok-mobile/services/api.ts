/**
 * API Service
 * 
 * Handles all HTTP requests to the backend
 */

import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Get backend URL dynamically
const getBackendUrl = () => {
  if (Platform.OS === 'web') return 'http://localhost:4001';
  
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    const url = `http://${ip}:4001`;
    console.log('🔗 [API] Configuring backend URL:', url);
    return url;
  }
  
  const url = Platform.OS === 'android' 
    ? 'http://10.0.2.2:4001' 
    : 'http://localhost:4001';
  
  console.log('⚠️ [API] Could not detect LAN IP, using fallback URL:', url);
  return url;
};

const API_URL = getBackendUrl();

// Storage keys
const TOKEN_KEY = 'auth_token';
const REFRESH_KEY = 'refresh_token';
const USER_KEY = 'user_data';

export interface User {
  id: string;
  phone: string;
  username?: string;
  avatar?: string;
  bio?: string;
  dataclausUserId?: string;
}

export interface Video {
  id: string;
  url: string;
  thumbnail: string;
  description: string;
  creator: {
    id: string;
    username: string;
    avatar: string;
    verified: boolean;
  };
  likes: number;
  comments: number;
  shares: number;
  views: number;
  music: {
    title: string;
    artist: string;
  };
  isLiked?: boolean;
  likesCount?: number;
  viewsCount?: number;
}

export interface Earnings {
  totalEarned: number;
  pendingBalance: number;
  availableBalance: number;
  qualityScore: number;
}

class ApiService {
  private token: string | null = null;

  constructor() {
    this.loadToken();
  }

  private async loadToken() {
    try {
      this.token = await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      // Secure store not available on web
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  // ======================
  // AUTH
  // ======================

  async requestOtp(phone: string, recaptchaToken?: string) {
    return this.request<{ success: boolean; otp?: string; expiresIn: number }>(
      'POST',
      '/auth/request-otp',
      { phone, recaptchaToken }
    );
  }

  async verifyOtp(phone: string, otp: string) {
    const result = await this.request<{
      success: boolean;
      isNewUser: boolean;
      user: User;
      tokens: {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
      };
    }>('POST', '/auth/verify-otp', { phone, otp });

    // Store tokens
    this.token = result.tokens.accessToken;
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, result.tokens.accessToken);
      await SecureStore.setItemAsync(REFRESH_KEY, result.tokens.refreshToken);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(result.user));
    } catch {
      // Web fallback
    }

    return result;
  }

  async updateProfile(data: { username?: string; avatar?: string; bio?: string }) {
    return this.request<{ success: boolean; user: User }>('PUT', '/auth/profile', data);
  }

  async getMe() {
    return this.request<User>('GET', '/auth/me');
  }

  async logout() {
    this.token = null;
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
    } catch {
      // Web fallback
    }
  }

  async isLoggedIn(): Promise<boolean> {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      return !!token;
    } catch {
      return !!this.token;
    }
  }

  async getStoredUser(): Promise<User | null> {
    try {
      const data = await SecureStore.getItemAsync(USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  // ======================
  // VIDEOS
  // ======================

  async getFeed(page: number = 1, limit: number = 10) {
    return this.request<{
      videos: Array<Video | { type: 'ad'; adType: string }>;
      page: number;
      limit: number;
      hasMore: boolean;
    }>('GET', `/videos/feed?page=${page}&limit=${limit}`);
  }

  async likeVideo(videoId: string) {
    return this.request<{
      success: boolean;
      isLiked: boolean;
      likesCount: number;
    }>('POST', `/videos/${videoId}/like`);
  }

  async recordView(videoId: string, duration: number, completed: boolean) {
    return this.request<{ success: boolean; isNewView: boolean }>(
      'POST',
      `/videos/${videoId}/view`,
      { duration, completed }
    );
  }

  // ======================
  // EARNINGS
  // ======================

  async getEarnings() {
    return this.request<Earnings>('GET', '/earnings/summary');
  }

  async getTransactionHistory() {
    return this.request<{
      transactions: Array<{
        id: string;
        type: string;
        amount: number;
        currency: string;
        description: string;
        timestamp: string;
      }>;
      page: number;
      hasMore: boolean;
    }>('GET', '/earnings/history');
  }

  // ======================
  // DATACLAUS
  // ======================

  async forwardSensorData(events: Array<{ eventType: string; timestamp: string; payload: Record<string, unknown> }>) {
    return this.request<{ eventsReceived: number }>('POST', '/dataclaus/sensor', { events });
  }

  async recordAdImpression(adType: string, revenue: number) {
    return this.request<{
      success: boolean;
      impressionId: string;
      userShare: number;
      devShare: number;
    }>('POST', '/dataclaus/ad-impression', { adType, revenue });
  }
}

export const api = new ApiService();
export default api;
