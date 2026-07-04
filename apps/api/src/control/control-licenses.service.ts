import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function generateLicenseKey(): string {
  const seg = () => Math.random().toString(36).substring(2, 7).toUpperCase();
  return `XP-${seg()}-${seg()}-${seg()}-${seg()}`;
}

interface CreateLicenseDto {
  customerId: string;
  plan?: string;
  maxUsers?: number;
  maxServers?: number;
  trialEndsAt?: string;
  expiresAt?: string;
  serverDomain?: string;
}

@Injectable()
export class ControlLicensesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(page = 1, limit = 20, customerId?: string) {
    const where = customerId ? { customerId } : {};
    const skip = (page - 1) * limit;
    return Promise.all([
      this.prisma.customerLicense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true, email: true } } },
      }),
      this.prisma.customerLicense.count({ where }),
    ]).then(([data, total]) => ({ data, total, page, limit }));
  }

  async findOne(id: string) {
    const license = await this.prisma.customerLicense.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        logs: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!license) throw new NotFoundException('License not found');
    return license;
  }

  create(dto: CreateLicenseDto) {
    const key = generateLicenseKey();
    return this.prisma.customerLicense.create({
      data: {
        key,
        customerId: dto.customerId,
        plan: dto.plan ?? 'STARTER',
        maxUsers: dto.maxUsers ?? 500,
        maxServers: dto.maxServers ?? 2,
        trialEndsAt: dto.trialEndsAt ? new Date(dto.trialEndsAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        serverDomain: dto.serverDomain,
      },
      include: { customer: { select: { name: true, email: true } } },
    });
  }

  async update(id: string, dto: Partial<CreateLicenseDto> & { status?: string; serverIp?: string }) {
    await this.findOne(id);
    return this.prisma.customerLicense.update({
      where: { id },
      data: {
        ...(dto.plan !== undefined && { plan: dto.plan }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.maxUsers !== undefined && { maxUsers: dto.maxUsers }),
        ...(dto.maxServers !== undefined && { maxServers: dto.maxServers }),
        ...(dto.serverDomain !== undefined && { serverDomain: dto.serverDomain }),
        ...(dto.serverIp !== undefined && { serverIp: dto.serverIp }),
        ...(dto.trialEndsAt !== undefined && { trialEndsAt: dto.trialEndsAt ? new Date(dto.trialEndsAt) : null }),
        ...(dto.expiresAt !== undefined && { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }),
      },
    });
  }

  async suspend(id: string) {
    await this.findOne(id);
    return this.prisma.customerLicense.update({ where: { id }, data: { status: 'SUSPENDED' } });
  }

  async activate(id: string) {
    await this.findOne(id);
    return this.prisma.customerLicense.update({
      where: { id },
      data: { status: 'ACTIVE', activatedAt: new Date() },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.customerLicense.delete({ where: { id } });
  }
}
