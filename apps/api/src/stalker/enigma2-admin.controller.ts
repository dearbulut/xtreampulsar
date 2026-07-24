import {
  Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

const userSel = { user: { select: { id: true, username: true, status: true } } };

@Controller('enigma2-devices')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('ADMIN')
export class Enigma2AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@Query('search') search?: string) {
    return this.prisma.enigma2Device.findMany({
      where: search
        ? { OR: [{ mac: { contains: search, mode: 'insensitive' } }, { deviceName: { contains: search, mode: 'insensitive' } }] }
        : undefined,
      include: userSel,
      orderBy: { lastSeen: 'desc' },
    });
  }

  @Post()
  @RequirePermission('users.edit')
  create(@Body() body: { mac: string; userId?: string; deviceName?: string; boxType?: string; oeVersion?: string }) {
    return this.prisma.enigma2Device.create({
      data: {
        mac: body.mac.toUpperCase().trim(),
        userId: body.userId ?? null,
        deviceName: body.deviceName ?? null,
        boxType: body.boxType ?? null,
        ...(body.oeVersion ? { oeVersion: body.oeVersion } : {}),
      },
      include: userSel,
    });
  }

  @Put(':id')
  @RequirePermission('users.edit')
  update(@Param('id') id: string, @Body() body: { userId?: string | null; deviceName?: string | null; boxType?: string | null; oeVersion?: string }) {
    const data: Record<string, unknown> = {};
    if (body.userId !== undefined) data.userId = body.userId ?? null;
    if (body.deviceName !== undefined) data.deviceName = body.deviceName ?? null;
    if (body.boxType !== undefined) data.boxType = body.boxType ?? null;
    if (body.oeVersion !== undefined) data.oeVersion = body.oeVersion;
    return this.prisma.enigma2Device.update({ where: { id }, data, include: userSel });
  }

  @Delete(':id')
  @RequirePermission('users.edit')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.prisma.enigma2Device.delete({ where: { id } });
  }
}
