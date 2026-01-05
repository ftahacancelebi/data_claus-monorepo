/**
 * Auth Controller
 *
 * Proxies authentication requests to DataClaus API.
 * Handles OTP flow for end-user authentication.
 */

import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Headers,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { DataClausService } from '../dataclaus/dataclaus.service';

class RequestOTPDto {
  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  recaptchaToken?: string;
}

class VerifyOTPDto {
  @IsString()
  phone!: string;

  @IsString()
  otp!: string;
}

class LoginDto {
  @IsString()
  email!: string;

  @IsString()
  password!: string;
}

class RegisterDto {
  @IsString()
  email!: string;

  @IsString()
  name!: string;

  @IsString()
  password!: string;
}

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  bio?: string;
}

@Controller('auth')
export class AuthController {
  private readonly apiUrl: string;

  constructor(private readonly dataClausService: DataClausService) {
    this.apiUrl = process.env.DATACLAUS_API_URL || 'http://localhost:3000';
  }

  /**
   * Login with email and password.
   * Proxies to DataClaus NestJS API.
   */
  @Post('login')
  async login(@Body() dto: LoginDto): Promise<{
    accessToken: string;
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
  }> {
    const response = await fetch(`${this.apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: dto.email, password: dto.password }),
    });

    if (!response.ok) {
      const error = (await response
        .json()
        .catch(() => ({ message: 'Login failed' }))) as { message: string };
      throw new UnauthorizedException(
        error.message || 'Invalid email or password',
      );
    }

    return (await response.json()) as {
      accessToken: string;
      user: {
        id: string;
        email: string;
        name: string;
        role: string;
      };
    };
  }

  /**
   * Register with email, name, and password.
   * Proxies to DataClaus NestJS API.
   */
  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<{
    accessToken: string;
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
  }> {
    const response = await fetch(`${this.apiUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: dto.email,
        name: dto.name,
        password: dto.password,
        role: 'user', // End-users from mobile are always 'user' role
      }),
    });

    if (!response.ok) {
      const error = (await response
        .json()
        .catch(() => ({ message: 'Registration failed' }))) as {
        message: string;
      };
      throw new BadRequestException(error.message || 'Registration failed');
    }

    return (await response.json()) as {
      accessToken: string;
      user: {
        id: string;
        email: string;
        name: string;
        role: string;
      };
    };
  }

  /**
   * Request OTP for phone number.
   * Proxies to DataClaus API.
   */
  @Post('request-otp')
  async requestOTP(@Body() dto: RequestOTPDto): Promise<{
    success: boolean;
    otp?: string;
    expiresIn: number;
  }> {
    if (!dto.phone) {
      throw new BadRequestException('Phone number is required');
    }

    const result = await this.dataClausService.requestOTP(dto.phone);

    // In development, return the OTP for testing
    // In production, the OTP is only sent via SMS
    return {
      success: true,
      otp: process.env.NODE_ENV === 'development' ? '123456' : undefined,
      expiresIn: result.expiresIn,
    };
  }

  /**
   * Verify OTP and get tokens.
   * Proxies to DataClaus API.
   */
  @Post('verify-otp')
  async verifyOTP(@Body() dto: VerifyOTPDto): Promise<{
    success: boolean;
    isNewUser: boolean;
    user: {
      id: string;
      phone: string;
      username?: string;
      avatar?: string;
      bio?: string;
      dataclausUserId: string;
    };
    tokens: {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    };
  }> {
    if (!dto.phone || !dto.otp) {
      throw new BadRequestException('Phone and OTP are required');
    }

    const result = await this.dataClausService.verifyOTP(dto.phone, dto.otp);

    return {
      success: true,
      isNewUser: result.isNewUser,
      user: {
        id: result.user.id,
        phone: result.user.phone,
        username: result.user.displayName,
        avatar: result.user.avatarUrl,
        bio: undefined,
        dataclausUserId: result.user.id,
      },
      tokens: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
      },
    };
  }

  /**
   * Get current user profile.
   */
  @Get('me')
  async getMe(@Headers('authorization') authHeader?: string): Promise<{
    id: string;
    phone: string;
    username?: string;
    avatar?: string;
    bio?: string;
    dataclausUserId?: string;
    qualityScore?: number;
  }> {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header required');
    }

    const token = authHeader.replace('Bearer ', '');
    const user = await this.dataClausService.getUserProfile(token);

    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return {
      id: user.id,
      phone: user.phone,
      username: user.displayName,
      avatar: user.avatarUrl,
      bio: undefined,
      dataclausUserId: user.id,
      qualityScore: user.qualityScore,
    };
  }

  /**
   * Update user profile.
   */
  @Put('profile')
  async updateProfile(
    @Headers('authorization') authHeader: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<{
    success: boolean;
    user: { id: string; phone: string; username?: string };
  }> {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header required');
    }

    const token = authHeader.replace('Bearer ', '');
    const user = await this.dataClausService.getUserProfile(token);

    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }

    // For now, just return the current profile
    // Profile updates would need a dedicated endpoint in DataClaus API
    return {
      success: true,
      user: {
        id: user.id,
        phone: user.phone,
        username: dto.username || user.displayName,
      },
    };
  }
}
