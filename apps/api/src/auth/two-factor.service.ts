import { Injectable, UnauthorizedException } from '@nestjs/common';
import { generate, verify as otpVerify, generateSecret, generateURI } from 'otplib';
import * as qrcode from 'qrcode';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TwoFactorService {
  constructor(private readonly prisma: PrismaService) {}

  async generateSetup(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    if (!user) throw new UnauthorizedException('User not found');

    const secret = generateSecret();
    const otpauthUrl = generateURI({
      issuer: 'XtreamPulsar',
      label: user.username,
      secret,
    });
    const qrCodeImage = await qrcode.toDataURL(otpauthUrl);

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    return { secret, qrCodeUrl: otpauthUrl, qrCodeImage };
  }

  async verifyCode(code: string, secret: string): Promise<boolean> {
    try {
      const result = await otpVerify({ token: code, secret });
      return result.valid;
    } catch {
      return false;
    }
  }

  async enableTwoFactor(userId: string, code: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true },
    });
    if (!user?.twoFactorSecret) throw new UnauthorizedException('2FA setup not started');

    const valid = await this.verifyCode(code, user.twoFactorSecret);
    if (!valid) throw new UnauthorizedException('Invalid verification code');

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });
  }

  async disableTwoFactor(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });
    if (!user) throw new UnauthorizedException('User not found');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid password');

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
  }

  async generateToken(secret: string): Promise<string> {
    return generate({ secret });
  }
}
