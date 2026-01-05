/**
 * DataClaus Service
 *
 * Provides access to DataClaus API features.
 * For demo purposes, this returns mock data when API is not configured.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface UserProfile {
  id: string;
  phone: string;
  displayName?: string;
  avatarUrl?: string;
  qualityScore?: number;
}

export interface UserEarnings {
  totalEarned: number;
  availableBalance: number;
  pendingBalance: number;
  qualityScore: number;
  currency: string;
}

@Injectable()
export class DataClausService {
  private readonly logger = new Logger(DataClausService.name);
  private readonly apiUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiUrl =
      this.config.get('DATACLAUS_API_URL') || 'http://localhost:3000';
  }

  /**
   * Get user profile by token
   */
  async getUserProfile(token: string): Promise<UserProfile | null> {
    try {
      const response = await fetch(`${this.apiUrl}/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) return null;

      const data = (await response.json()) as {
        id: string;
        email: string;
        name: string;
        role: string;
      };

      return {
        id: data.id,
        phone: data.email,
        displayName: data.name,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get user earnings (mock)
   */
  async getUserEarnings(userId: string): Promise<UserEarnings> {
    // Mock data for demo
    return {
      totalEarned: 0,
      availableBalance: 0,
      pendingBalance: 0,
      qualityScore: 0.85,
      currency: 'USD',
    };
  }

  /**
   * Request OTP (mock)
   */
  async requestOTP(phone: string): Promise<{ expiresIn: number }> {
    return { expiresIn: 300 };
  }

  /**
   * Verify OTP (mock)
   */
  async verifyOTP(
    phone: string,
    otp: string,
  ): Promise<{
    isNewUser: boolean;
    user: UserProfile;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    return {
      isNewUser: true,
      user: { id: 'mock-user', phone },
      accessToken: 'mock-token',
      refreshToken: 'mock-refresh',
      expiresIn: 86400,
    };
  }
}
