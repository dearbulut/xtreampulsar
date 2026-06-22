import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import type { Reseller } from '@xtreampulsar/database';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException(`Account is ${user.status.toLowerCase()}`);
    }

    return this.issueTokens(user);
  }

  async refresh(rawToken: string) {
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: hash },
      include: { user: true },
    });

    if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { isRevoked: true },
    });

    return this.issueTokens(stored.user);
  }

  async logout(rawToken: string): Promise<void> {
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await this.prisma.refreshToken.updateMany({
      where: { token: hash },
      data: { isRevoked: true },
    });
  }

  async me(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        status: true,
        maxConnections: true,
        expiresAt: true,
        createdAt: true,
        resellerId: true,
      },
    });
  }

  async resellerLogin(dto: LoginDto) {
    const reseller = await this.prisma.reseller.findFirst({
      where: { username: dto.username, deletedAt: null },
    });

    if (!reseller || !(await bcrypt.compare(dto.password, reseller.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!reseller.isActive) {
      throw new ForbiddenException('Reseller account is inactive');
    }

    const payload = {
      sub: reseller.id,
      username: reseller.username,
      role: 'RESELLER',
      type: 'reseller',
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    return {
      accessToken,
      reseller: {
        id: reseller.id,
        username: reseller.username,
        credits: reseller.credits,
        tier: reseller.tier,
      } satisfies Partial<Reseller>,
    };
  }

  private async issueTokens(user: {
    id: string;
    username: string;
    role: string;
  }) {
    const payload = { sub: user.id, username: user.username, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.config.get<string>('jwt.expiresIn', '15m'),
    });

    const rawRefresh = crypto.randomBytes(64).toString('hex');
    const hashedRefresh = crypto
      .createHash('sha256')
      .update(rawRefresh)
      .digest('hex');

    await this.prisma.refreshToken.create({
      data: {
        token: hashedRefresh,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken: rawRefresh };
  }
}
