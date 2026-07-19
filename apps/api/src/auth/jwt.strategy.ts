import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

interface JwtPayload {
  sub: string;
  username: string;
  role: string;
  type?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret')!,
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type === 'reseller') {
      const reseller = await this.prisma.reseller.findFirst({
        where: { id: payload.sub, deletedAt: null },
        select: { id: true, username: true, isActive: true },
      });
      if (!reseller || !reseller.isActive) {
        throw new UnauthorizedException('Reseller not found or inactive');
      }
      return { id: reseller.id, username: reseller.username, role: 'RESELLER', type: 'reseller' };
    }

    // Client (abone) panel token'ı: rolü her zaman USER'a sabitle — DB rolü ADMIN/RESELLER
    // olsa bile client panelde abone gibi davranmalı (aksi halde @Roles('USER') 403 verir).
    if (payload.type === 'user') {
      const sub = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, username: true, status: true },
      });
      if (!sub || sub.status !== 'ACTIVE') {
        throw new UnauthorizedException('User not found or inactive');
      }
      return { id: sub.id, username: sub.username, role: 'USER', type: 'user' };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, role: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    return { id: user.id, username: user.username, role: user.role };
  }
}
