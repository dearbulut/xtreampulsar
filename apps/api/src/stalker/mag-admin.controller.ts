import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('mag-devices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class MagAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query('search') search?: string) {
    return this.prisma.magDevice.findMany({
      where: search
        ? { mac: { contains: search, mode: 'insensitive' } }
        : undefined,
      include: {
        user: { select: { id: true, username: true, status: true } },
      },
      orderBy: { lastSeen: 'desc' },
    });
  }

  @Post()
  create(@Body() body: { mac: string; userId?: string; deviceType?: string }) {
    return this.prisma.magDevice.create({
      data: {
        mac: body.mac.toUpperCase().trim(),
        userId: body.userId ?? null,
        ...(body.deviceType ? { serialNumber: body.deviceType } : {}),
      },
      include: { user: { select: { id: true, username: true, status: true } } },
    });
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: { userId?: string | null }) {
    return this.prisma.magDevice.update({
      where: { id },
      data: { userId: body.userId ?? null },
      include: { user: { select: { id: true, username: true, status: true } } },
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.prisma.magDevice.delete({ where: { id } });
  }
}
