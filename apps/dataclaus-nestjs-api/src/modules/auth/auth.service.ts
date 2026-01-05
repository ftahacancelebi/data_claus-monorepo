import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { DeveloperService } from '../developer/developer.service';
import { DataClausUser } from '../dataclaus-user/entities/dataclaus-user.entity';
import { WalletService } from '../wallet/wallet.service';
import { WalletType } from '../../common/constants';
import { LoginDto, AuthResponseDto, JwtPayload } from './dto';
import { Role } from '../../common/decorators';

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
  role?: 'developer' | 'user' | 'buyer';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly developerService: DeveloperService,
    private readonly jwtService: JwtService,
    @InjectRepository(DataClausUser)
    private readonly userRepository: Repository<DataClausUser>,
    private readonly walletService: WalletService,
  ) {}

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
}
