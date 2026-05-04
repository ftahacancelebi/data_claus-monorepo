import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Repository, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { DeveloperService } from '../developer/developer.service';
import { DataClausUser } from '../dataclaus-user/entities/dataclaus-user.entity';
import { WalletService } from '../wallet/wallet.service';
import { WalletType } from '../../common/constants';
import { LoginDto, AuthResponseDto, JwtPayload } from './dto';
import { Role } from '../../common/decorators';
import { OtpRequest } from './entities';
import { EmailService } from '../email/email.service';
import { RecaptchaService } from '../recaptcha/recaptcha.service';

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
  role?: 'developer' | 'user' | 'buyer';
}

export interface OtpRequestResult {
  status: 'sent';
  expiresInSeconds: number;
}

export interface OtpVerifyResult extends AuthResponseDto {
  refreshToken: string;
}

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_MAX_ATTEMPTS = 5;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '30d';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly developerService: DeveloperService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(DataClausUser)
    private readonly userRepository: Repository<DataClausUser>,
    @InjectRepository(OtpRequest)
    private readonly otpRepository: Repository<OtpRequest>,
    private readonly walletService: WalletService,
    private readonly emailService: EmailService,
    private readonly recaptchaService: RecaptchaService,
  ) {}

  // ---------------------------------------------------------------------------
  // Existing email + password flows (developers, legacy user accounts)
  // ---------------------------------------------------------------------------

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    // Try developer first
    const developer = await this.developerService.findByEmail(dto.email);

    if (developer) {
      const isPasswordValid = await bcrypt.compare(
        dto.password,
        developer.password,
      );
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const payload: JwtPayload = {
        sub: developer.id,
        email: developer.email,
        role: Role.DEVELOPER,
      };

      return {
        accessToken: this.jwtService.sign(payload),
        user: {
          id: developer.id,
          email: developer.email,
          name: developer.name,
          role: Role.DEVELOPER,
        },
      };
    }

    // Try end-user
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (user && user.passwordHash) {
      const isPasswordValid = await bcrypt.compare(
        dto.password,
        user.passwordHash,
      );
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Update last login
      user.lastLoginAt = new Date();
      await this.userRepository.save(user);

      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        role: Role.USER,
      };

      return {
        accessToken: this.jwtService.sign(payload),
        user: {
          id: user.id,
          email: user.email,
          name: user.displayName || user.email,
          role: Role.USER,
        },
      };
    }

    throw new UnauthorizedException('Invalid credentials');
  }

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const role = dto.role || 'user';

    if (role === 'developer') {
      // Register as developer
      const developer = await this.developerService.register({
        email: dto.email,
        password: dto.password,
        name: dto.name,
      });

      const payload: JwtPayload = {
        sub: developer.id,
        email: developer.email,
        role: Role.DEVELOPER,
      };

      return {
        accessToken: this.jwtService.sign(payload),
        user: {
          id: developer.id,
          email: developer.email,
          name: developer.name,
          role: Role.DEVELOPER,
        },
      };
    }

    // Register as end-user
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = this.userRepository.create({
      email: dto.email,
      passwordHash,
      displayName: dto.name,
      emailVerified: false,
    });

    await this.userRepository.save(user);

    // Create wallet
    const wallet = await this.walletService.create({
      owner_id: user.id,
      type: role === 'buyer' ? WalletType.BUYER : WalletType.USER,
      currency: 'USD',
    });

    user.walletId = wallet.id;
    await this.userRepository.save(user);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: role === 'buyer' ? Role.BUYER : Role.USER,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.displayName || user.email,
        role: role === 'buyer' ? Role.BUYER : Role.USER,
      },
    };
  }

  async validateToken(token: string): Promise<JwtPayload | null> {
    try {
      return this.jwtService.verify<JwtPayload>(token);
    } catch {
      return null;
    }
  }

  async getMe(userId: string) {
    // Try developer first
    try {
      return await this.developerService.findById(userId);
    } catch {
      // Not a developer, try user
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user) {
      return {
        id: user.id,
        email: user.email,
        name: user.displayName || user.email,
        role: Role.USER,
      };
    }

    throw new UnauthorizedException('User not found');
  }

  // ---------------------------------------------------------------------------
  // OTP-based authentication (end-user flow)
  // ---------------------------------------------------------------------------

  /**
   * Request a one-time password.
   *
   * - Verifies reCAPTCHA Enterprise token (or simulation mode for dev).
   * - Issues a 6-digit code, stores its bcrypt hash with a 5-minute TTL.
   * - Invalidates any prior unused OTPs for the email so a new request
   *   always supersedes pending ones (prevents stale-code reuse).
   */
  async requestOtp(
    email: string,
    recaptchaToken?: string,
    ipAddress?: string,
  ): Promise<OtpRequestResult> {
    const normalizedEmail = email.trim().toLowerCase();

    // reCAPTCHA verification — required outside simulation mode.
    // In simulation mode an empty token is rejected, so callers must always
    // send something. The mode itself is selected inside the service.
    await this.recaptchaService.verifyEnterprise(
      recaptchaToken ?? '',
      'OTP_REQUEST',
    );

    // Invalidate prior unused, unexpired codes for this email.
    await this.otpRepository.update(
      {
        email: normalizedEmail,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      { usedAt: new Date() },
    );

    const code = this.generateOtpCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.otpRepository.save(
      this.otpRepository.create({
        email: normalizedEmail,
        codeHash,
        expiresAt,
        attempts: 0,
        ipAddress: ipAddress ?? null,
      }),
    );

    await this.emailService.sendOtp(normalizedEmail, code);

    // Capstone-mode visibility (no SMTP server in dev environments).
    if (this.configService.get<string>('EMAIL_PROVIDER', 'console') === 'console') {
      this.logger.log(`[OTP] ${normalizedEmail} -> ${code}`);
    }

    return { status: 'sent', expiresInSeconds: OTP_TTL_MS / 1000 };
  }

  /**
   * Verify an OTP code and return access + refresh tokens.
   *
   * On invalid code, attempts counter increments and 401 returned.
   * After OTP_MAX_ATTEMPTS, the row is locked (no further verifies).
   * On first successful verify for a new email, the user account and wallet
   * are auto-provisioned.
   */
  async verifyOtp(email: string, code: string): Promise<OtpVerifyResult> {
    const normalizedEmail = email.trim().toLowerCase();

    const otp = await this.otpRepository.findOne({
      where: {
        email: normalizedEmail,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    if (!otp) {
      throw new UnauthorizedException('OTP not found or expired');
    }

    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      // Lock the row — explicit signal in error to UI.
      throw new HttpException(
        'OTP attempt limit reached',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const valid = await bcrypt.compare(code, otp.codeHash);
    otp.attempts += 1;

    if (!valid) {
      await this.otpRepository.save(otp);
      throw new UnauthorizedException('Invalid OTP code');
    }

    otp.usedAt = new Date();
    await this.otpRepository.save(otp);

    const user = await this.findOrCreateUserByEmail(normalizedEmail);
    user.emailVerified = true;
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    return this.buildUserAuthResponse(user);
  }

  /**
   * Exchange a refresh token for a new access (and rotated refresh) token.
   * Refresh tokens are signed JWTs with `type: 'refresh'`.
   */
  async refresh(refreshToken: string): Promise<OtpVerifyResult> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Token is not a refresh token');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.buildUserAuthResponse(user);
  }

  /**
   * Periodic cleanup hook — call from a scheduled job to prune
   * expired OTPs older than 24h. Kept here so the auth module owns its data.
   */
  async pruneExpiredOtps(olderThan: Date = new Date(Date.now() - 24 * 60 * 60 * 1000)): Promise<number> {
    const result = await this.otpRepository.delete({
      expiresAt: LessThan(olderThan),
    });
    return result.affected ?? 0;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private generateOtpCode(): string {
    // 6-digit code from cryptographically-secure source.
    const value = crypto.randomInt(0, 1_000_000);
    return value.toString().padStart(6, '0');
  }

  private async findOrCreateUserByEmail(email: string): Promise<DataClausUser> {
    let user = await this.userRepository.findOne({ where: { email } });
    if (user) return user;

    user = this.userRepository.create({
      email,
      passwordHash: '',
      displayName: email.split('@')[0] ?? null,
      emailVerified: true,
    });
    user = await this.userRepository.save(user);

    const wallet = await this.walletService.create({
      owner_id: user.id,
      type: WalletType.USER,
      currency: 'USD',
    });

    user.walletId = wallet.id;
    user = await this.userRepository.save(user);
    return user;
  }

  private buildUserAuthResponse(user: DataClausUser): OtpVerifyResult {
    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: Role.USER,
      type: 'access',
    };
    const refreshPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: Role.USER,
      type: 'refresh',
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: ACCESS_TOKEN_TTL,
    });
    const refreshToken = this.jwtService.sign(refreshPayload, {
      expiresIn: REFRESH_TOKEN_TTL,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.displayName || user.email,
        role: Role.USER,
      },
    };
  }
}
