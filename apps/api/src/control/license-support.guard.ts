import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LicenseSupportGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Record<string, unknown>>();
    const headers = req.headers as Record<string, string | undefined>;
    const key = headers['x-license-key'];
    if (!key) throw new UnauthorizedException('X-License-Key header required');

    const license = await this.prisma.customerLicense.findFirst({
      where: { key, status: { in: ['ACTIVE', 'TRIAL'] } },
      include: { customer: { select: { id: true, name: true, email: true } } },
    });
    if (!license) throw new UnauthorizedException('Invalid or inactive license key');

    (req as Record<string, unknown>).license = license;
    (req as Record<string, unknown>).licenseCustomer = (license as Record<string, unknown>).customer;
    return true;
  }
}
