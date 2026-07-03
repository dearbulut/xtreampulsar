import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Inject,
  Optional,
} from '@nestjs/common';
import type { Reseller } from '@xtreampulsar/database';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { UserActivityService } from '../user/user-activity.service';
import { TwoFactorService } from './two-factor.service';
import { LoginDto } from './dto/login.dto';
import { REDIS_CLIENT } from '../redis/redis.module';

const BRUTE_MAX_ATTEMPTS = 5;
const BRUTE_WINDOW_SEC = 15 * 60;
const RESELLER_REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly twoFactorService: TwoFactorService,
    private readonly userActivityService: UserActivityService,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
  ) {}

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      throw new UnauthorizedException('Mevcut şifre yanlış');
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { password: hashed } });
    return { success: true };
  }

  private bruteKey(ip: string) { return `login_attempts:${ip}`; }
  private blockKey(ip: string)  { return `login_blocked:${ip}`; }

  async checkBrute(ip: string): Promise<void> {
    if (!this.redis || !ip) return;
    const blocked = await this.redis.get(this.blockKey(ip)).catch(() => null);
    if (blocked) throw new ForbiddenException('Too many login attempts. Try again in 15 minutes.');
  }

  async recordFailedAttempt(ip: string): Promise<void> {
    if (!this.redis || !ip) return;
    const key = this.bruteKey(ip);
    const attempts = await this.redis.incr(key).catch(() => 0);
    await this.redis.expire(key, BRUTE_WINDOW_SEC).catch(() => {});
    if (attempts >= BRUTE_MAX_ATTEMPTS) {
      await this.redis.setex(this.blockKey(ip), BRUTE_WINDOW_SEC, '1').catch(() => {});
    }
  }

  async clearBruteAttempts(ip: string): Promise<void> {
    if (!this.redis || !ip) return;
    await this.redis.del(this.bruteKey(ip)).catch(() => {});
  }

  async login(dto: LoginDto, ip = '', userAgent = '') {
    await this.checkBrute(ip);

    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      await this.recordFailedAttempt(ip);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.clearBruteAttempts(ip);

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException(`Account is ${user.status.toLowerCase()}`);
    }

    void this.userActivityService.logActivity({
      userId: user.id,
      action: 'LOGIN',
      ip,
      userAgent,
      deviceType: this.userActivityService.detectDeviceType(userAgent),
    });

    // 2FA zorunluluğu: hesapta require2FA=true ama 2FA kurulmamışsa setup zorunlu
    if ((user as { require2FA?: boolean }).require2FA && !user.twoFactorEnabled) {
      return { require2FASetup: true };
    }

    if (user.twoFactorEnabled) {
      const tempToken = this.jwtService.sign(
        { sub: user.id, type: '2fa_pending', username: user.username, role: user.role },
        { expiresIn: '5m' },
      );
      return { requiresTwoFactor: true, tempToken };
    }

    return this.issueTokens(user);
  }

  async verifyTwoFactor(tempToken: string, code: string) {
    let payload: { sub: string; type: string; username: string; role: string };
    try {
      payload = this.jwtService.verify<typeof payload>(tempToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (payload.type !== '2fa_pending') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, role: true, twoFactorSecret: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('User not found or inactive');
    if (!user.twoFactorSecret) throw new UnauthorizedException('2FA not configured');

    const valid = await this.twoFactorService.verifyCode(code, user.twoFactorSecret);
    if (!valid) throw new UnauthorizedException('Invalid verification code');

    return this.issueTokens({ id: user.id, username: user.username, role: user.role });
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
        twoFactorEnabled: true,
      },
    });
  }

  private resellerBruteKey(ip: string) { return `brute:reseller:${ip}`; }
  private resellerBlockKey(ip: string)  { return `brute:reseller:block:${ip}`; }

  async checkResellerBrute(ip: string): Promise<void> {
    if (!this.redis || !ip) return;
    const blocked = await this.redis.get(this.resellerBlockKey(ip)).catch(() => null);
    if (blocked) {
      const ttl = await this.redis.ttl(this.resellerBlockKey(ip)).catch(() => BRUTE_WINDOW_SEC);
      const minutes = Math.ceil(ttl / 60);
      throw new ForbiddenException(`Çok fazla başarısız deneme. ${minutes} dakika sonra tekrar deneyin.`);
    }
  }

  async recordResellerFailedAttempt(ip: string): Promise<void> {
    if (!this.redis || !ip) return;
    const key = this.resellerBruteKey(ip);
    const attempts = await this.redis.incr(key).catch(() => 0);
    await this.redis.expire(key, BRUTE_WINDOW_SEC).catch(() => {});
    if (attempts >= BRUTE_MAX_ATTEMPTS) {
      await this.redis.setex(this.resellerBlockKey(ip), BRUTE_WINDOW_SEC, '1').catch(() => {});
    }
  }

  async clearResellerBruteAttempts(ip: string): Promise<void> {
    if (!this.redis || !ip) return;
    await this.redis.del(this.resellerBruteKey(ip)).catch(() => {});
  }

  async resellerLogin(dto: LoginDto, ip = '') {
    await this.checkResellerBrute(ip);

    const reseller = await this.prisma.reseller.findFirst({
      where: { username: dto.username, deletedAt: null },
    });

    if (!reseller || !(await bcrypt.compare(dto.password, reseller.password))) {
      await this.recordResellerFailedAttempt(ip);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.clearResellerBruteAttempts(ip);

    if (!reseller.isActive) {
      throw new ForbiddenException('Reseller account is inactive');
    }

    const payload = {
      sub: reseller.id,
      username: reseller.username,
      role: 'RESELLER',
      type: 'reseller',
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const rawRefresh = crypto.randomBytes(64).toString('hex');
    const hashedRefresh = crypto.createHash('sha256').update(rawRefresh).digest('hex');

    await this.prisma.resellerRefreshToken.create({
      data: {
        token: hashedRefresh,
        resellerId: reseller.id,
        expiresAt: new Date(Date.now() + RESELLER_REFRESH_EXPIRES_MS),
      },
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      reseller: {
        id: reseller.id,
        username: reseller.username,
        credits: reseller.credits,
        tier: reseller.tier,
      } satisfies Partial<Reseller>,
    };
  }

  async resellerRefresh(rawToken: string) {
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const stored = await this.prisma.resellerRefreshToken.findUnique({
      where: { token: hash },
      include: { reseller: true },
    });

    if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!stored.reseller.isActive) {
      throw new ForbiddenException('Reseller account is inactive');
    }

    await this.prisma.resellerRefreshToken.update({
      where: { id: stored.id },
      data: { isRevoked: true },
    });

    const payload = {
      sub: stored.reseller.id,
      username: stored.reseller.username,
      role: 'RESELLER',
      type: 'reseller',
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const rawRefresh = crypto.randomBytes(64).toString('hex');
    const hashedRefresh = crypto.createHash('sha256').update(rawRefresh).digest('hex');

    await this.prisma.resellerRefreshToken.create({
      data: {
        token: hashedRefresh,
        resellerId: stored.reseller.id,
        expiresAt: new Date(Date.now() + RESELLER_REFRESH_EXPIRES_MS),
      },
    });

    return { accessToken, refreshToken: rawRefresh };
  }

  async resellerLogout(rawToken: string): Promise<void> {
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await this.prisma.resellerRefreshToken.updateMany({
      where: { token: hash },
      data: { isRevoked: true },
    });
  }

  private async issueTokens(user: { id: string; username: string; role: string }) {
    const payload = { sub: user.id, username: user.username, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.config.get<string>('jwt.expiresIn', '15m'),
    });

    const rawRefresh = crypto.randomBytes(64).toString('hex');
    const hashedRefresh = crypto.createHash('sha256').update(rawRefresh).digest('hex');

    await this.prisma.refreshToken.create({
      data: {
        token: hashedRefresh,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      user: { id: user.id, username: user.username, role: user.role as 'ADMIN' | 'RESELLER' | 'USER' },
    };
  }
}
