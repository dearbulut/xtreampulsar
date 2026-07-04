import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
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
      select: { username: true, twoFactorEnabled: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    if (user.twoFactorEnabled) {
      throw new ConflictException('2FA zaten aktif. Önce devre dışı bırakın.');
    }

    const secret = generateSecret();
    const otpauthUrl = generateURI({
      issuer: 'XtreamPulsar',
      label: user.username,
      secret,
    });
    const qrCodeImage = await qrcode.toDataURL(otpauthUrl);

    // Secret is written to the TEMPORARY column only. It is promoted to the
    // permanent twoFactorSecret solely on a successful enable/confirm, so
    // re-opening setup can never overwrite an already-active secret.
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorTempSecret: secret },
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
      select: { twoFactorTempSecret: true },
    });
    if (!user?.twoFactorTempSecret) {
      throw new BadRequestException('Kurulum başlatılmadı');
    }

    const valid = await this.verifyCode(code, user.twoFactorTempSecret);
    if (!valid) throw new UnauthorizedException('Invalid verification code');

    // Promote temp secret to permanent and enable — single atomic update.
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: user.twoFactorTempSecret,
        twoFactorEnabled: true,
        twoFactorTempSecret: null,
      },
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
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorTempSecret: null },
    });
  }

  async generateToken(secret: string): Promise<string> {
    return generate({ secret });
  }
}
