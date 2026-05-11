import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService, RegisterDto } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  LoginDto,
  AuthResponseDto,
  RequestOtpDto,
  VerifyOtpDto,
  RefreshTokenDto,
  OtpRequestResponseDto,
} from './dto';
import { Public, CurrentUser, CurrentUserData } from '../../common/decorators';

/**
 * httpOnly session cookie that mirrors the access token returned in the body.
 * The body field stays for SDKs / mobile clients that store the token
 * themselves; the cookie unlocks server-side route gating in the web app.
 */
const SESSION_COOKIE_NAME = 'dc_session';
// 30 days — kept in sync with the JWT access-token TTL in auth.service.ts.
// Anything shorter creates a window where the cookie expires but the
// frontend localStorage token is still valid, which produces the
// middleware ↔ login-page redirect loop.
const SESSION_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

class RegisterBodyDto implements RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    example: 'user',
    enum: ['developer', 'user', 'buyer'],
  })
  @IsOptional()
  @IsIn(['developer', 'user', 'buyer'])
  role?: 'developer' | 'user' | 'buyer';
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  @Throttle({ medium: { limit: 10, ttl: 60_000 } }) // 10 logins/min per IP
  @ApiOperation({
    summary: 'Login with email and password (works for all roles)',
  })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.login(dto);
    setSessionCookie(res, result.accessToken);
    return result;
  }

  @Post('register')
  @Public()
  @Throttle({ medium: { limit: 5, ttl: 60_000 } }) // 5 registrations/min per IP
  @ApiOperation({
    summary: 'Register a new account (specify role: developer, user, or buyer)',
  })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(
    @Body() dto: RegisterBodyDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.register(dto);
    setSessionCookie(res, result.accessToken);
    return result;
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear the session cookie' })
  @ApiResponse({ status: 200 })
  async logout(@Res({ passthrough: true }) res: Response) {
    clearSessionCookie(res);
    return { status: 'ok' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@CurrentUser() user: CurrentUserData) {
    return this.authService.getMe(user.id);
  }

  // ---------------------------------------------------------------------------
  // OTP-based end-user authentication
  // ---------------------------------------------------------------------------

  @Post('user/request-otp')
  @Public()
  @Throttle({ medium: { limit: 3, ttl: 60_000 } }) // 3 OTP requests/min per IP
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a one-time password for end-user login (email)',
  })
  @ApiResponse({ status: 200, type: OtpRequestResponseDto })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async requestOtp(
    @Body() dto: RequestOtpDto,
    @Req() req: Request,
  ): Promise<OtpRequestResponseDto> {
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() ??
      req.socket?.remoteAddress ??
      undefined;
    const result = await this.authService.requestOtp(
      dto.email,
      dto.recaptchaToken,
      ip,
    );
    return { status: result.status, expiresInSeconds: result.expiresInSeconds };
  }

  @Post('user/verify-otp')
  @Public()
  @Throttle({ medium: { limit: 10, ttl: 60_000 } }) // 10 verifies/min per IP
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP and exchange for access + refresh tokens',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP' })
  @ApiResponse({ status: 429, description: 'Attempt limit reached' })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyOtp(dto.email, dto.code);
    setSessionCookie(res, result.accessToken);
    return result;
  }

  @Post('user/refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a refresh token for a new access token' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.refresh(dto.refreshToken);
    setSessionCookie(res, result.accessToken);
    return result;
  }
}
