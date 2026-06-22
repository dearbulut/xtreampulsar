import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResellerService } from './reseller.service';
import { CreateResellerDto } from './dto/create-reseller.dto';
import { UpdateResellerDto } from './dto/update-reseller.dto';
import { AddCreditsDto } from './dto/add-credits.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('resellers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ResellerController {
  constructor(
    private readonly resellerService: ResellerService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Reseller self-service (reseller token) ──────────────────────────────

  @Get('me')
  @Roles('RESELLER')
  async getMe(@CurrentUser() user: JwtUser) {
    if (user.type !== 'reseller') throw new ForbiddenException('Reseller panel access only');
    return this.resellerService.findById(user.id);
  }

  @Get('me/stats')
  @Roles('RESELLER')
  async getMyStats(@CurrentUser() user: JwtUser) {
    if (user.type !== 'reseller') throw new ForbiddenException('Reseller panel access only');
    return this.resellerService.getStats(user.id);
  }

  @Get('me/expiring')
  @Roles('RESELLER')
  async getMyExpiringUsers(@CurrentUser() user: JwtUser, @Query('days') days?: string) {
    if (user.type !== 'reseller') throw new ForbiddenException('Reseller panel access only');
    const d = days ? parseInt(days, 10) : 7;
    const now = new Date();
    const threshold = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
    return this.prisma.user.findMany({
      where: {
        resellerId: user.id,
        deletedAt: null,
        status: 'ACTIVE',
        expiresAt: { gte: now, lte: threshold },
      },
      select: { id: true, username: true, expiresAt: true, maxConnections: true, status: true },
      orderBy: { expiresAt: 'asc' },
    });
  }

  @Get('me/credits')
  @Roles('RESELLER')
  async getMyCreditHistory(@CurrentUser() user: JwtUser, @Query() pagination: PaginationDto) {
    if (user.type !== 'reseller') throw new ForbiddenException('Reseller panel access only');
    return this.resellerService.getCreditHistory(user.id, pagination.page, pagination.limit);
  }

  // ─── Admin endpoints ──────────────────────────────────────────────────────

  @Get()
  findAll() {
    return this.resellerService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.resellerService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateResellerDto) {
    return this.resellerService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateResellerDto) {
    return this.resellerService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.resellerService.softDelete(id);
  }

  @Post(':id/add-credits')
  addCredits(
    @Param('id') id: string,
    @Body() dto: AddCreditsDto,
    @CurrentUser() admin: JwtUser,
  ) {
    return this.resellerService.addCredits(id, dto.amount, dto.reason, admin.id);
  }

  @Get(':id/credits')
  getCreditHistory(@Param('id') id: string, @Query() pagination: PaginationDto) {
    return this.resellerService.getCreditHistory(id, pagination.page, pagination.limit);
  }

  @Get(':id/users')
  getUsers(@Param('id') id: string, @Query() pagination: PaginationDto) {
    return this.resellerService.getUsers(id, pagination.page, pagination.limit);
  }

  @Get(':id/stats')
  getStats(@Param('id') id: string) {
    return this.resellerService.getStats(id);
  }
}
