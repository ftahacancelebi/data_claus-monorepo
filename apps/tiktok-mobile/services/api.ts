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
  const basePort = 4001; // TikTok Backend (proxies auth to DataClaus API)
  const apiPrefix = '/api';
  
  if (Platform.OS === 'web') return `http://localhost:${basePort}${apiPrefix}`;
  
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    const url = `http://${ip}:${basePort}${apiPrefix}`;
    console.log('🔗 [API] Configuring backend URL:', url);
    return url;
  }
  
  const url = Platform.OS === 'android' 
    ? `http://10.0.2.2:${basePort}${apiPrefix}` 
    : `http://localhost:${basePort}${apiPrefix}`;
  
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
  tags?: string[];
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
  // AUTH - Email/Password (Unified for all roles)
  // ======================

  async login(email: string, password: string) {
    console.log('🚀 [Mobile] Attempting login with:', email);
    
    try {
      const response = await this.request<any>('POST', '/auth/login', { email, password });
      console.log('✅ [Mobile] Login Raw Response:', JSON.stringify(response, null, 2));

      // Handle wrapped response (if wrapped in 'data')
      const result = response.data || response;

      if (!result || !result.user) {
        console.error('❌ [Mobile] Invalid response structure:', result);
        throw new Error('Invalid server response');
      }

      // Store token and create user object
      this.token = result.accessToken;
      const user: User = {
        id: result.user.id, // This is likely where it was failing
        phone: '',
        username: result.user.name,
        avatar: undefined,
        bio: undefined,
        dataclausUserId: result.user.id,
      };

      try {
        await SecureStore.setItemAsync(TOKEN_KEY, result.accessToken);
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      } catch {
        // Web fallback
      }

      return { user };
    } catch (error) {
      console.error('❌ [Mobile] Login Error:', error);
      throw error;
    }
  }



  async register(email: string, name: string, password: string) {
    console.log('🚀 [Mobile] Attempting register with:', email);
    
    try {
      // Register as end-user by default
      const response = await this.request<any>('POST', '/auth/register', { email, password, name, role: 'user' });
      console.log('✅ [Mobile] Register Raw Response:', JSON.stringify(response, null, 2));

      // Handle wrapped response (if wrapped in 'data')
      const result = response.data || response;

      if (!result || !result.user) {
        console.error('❌ [Mobile] Invalid response structure:', result);
        throw new Error('Invalid server response');
      }

      // Store token and create user object
      this.token = result.accessToken;
      const user: User = {
        id: result.user.id,
        phone: '',
        username: result.user.name,
        avatar: undefined,
        bio: undefined,
        dataclausUserId: result.user.id,
      };

      try {
        await SecureStore.setItemAsync(TOKEN_KEY, result.accessToken);
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      } catch {
        // Web fallback
      }

      return { user };
    } catch (error) {
      console.error('❌ [Mobile] Register Error:', error);
      throw error;
    }
  }

  // Legacy OTP methods (can be removed if not needed)
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
    const result = await this.request<{
      items: Array<{ type: 'video' | 'ad'; video?: Video; adType?: string }>;
      page: number;
      limit: number;
      hasMore: boolean;
    }>('GET', `/videos/feed?page=${page}&limit=${limit}`);

    // Transform items to match expected format in UI
    const videos = result.items.map(item => {
      if (item.type === 'ad') {
        return { type: 'ad' as const, adType: item.adType || 'banner' };
      }
      return item.video!;
    });

    return {
      videos,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
    };
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
  // ADS
  // ======================
  
  async recordAdImpression(adType: 'banner' | 'interstitial' | 'rewarded', grossRevenue?: number) {
    // If no explicit revenue provided, let backend assign default based on type
    const body = { adType, grossRevenue };
    return this.request<{
      success: boolean;
      impressionId: string;
      userNewTotal: number
    }>('POST', '/ads/impression', body);
  }

  async serveFeedAd(tags: string[]): Promise<{
    campaign_id: string;
    brand_name: string;
    headline: string;
    sub_copy: string;
    cta_label: string;
    image_url: string | null;
    matched_tags: string[];
  } | null> {
    if (tags.length === 0) return null;
    try {
      const encoded = encodeURIComponent(tags.join(','));
      return this.request<{
        campaign_id: string;
        brand_name: string;
        headline: string;
        sub_copy: string;
        cta_label: string;
        image_url: string | null;
        matched_tags: string[];
      } | null>('GET', `/ads/feed-serve?tags=${encoded}`);
    } catch {
      return null;
    }
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

  // ======================
  // AD CREATIVE
  // ======================

  async getActiveAdCreative(): Promise<{
    id: string;
    brandName: string;
    imageUrl: string;
    ctaText: string | null;
  } | null> {
    try {
      return await this.request<{
        id: string;
        brandName: string;
        imageUrl: string;
        ctaText: string | null;
      } | null>('GET', '/ads/creative');
    } catch {
      return null;
    }
  }

}

export const api = new ApiService();
export default api;
