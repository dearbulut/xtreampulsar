import {
  Controller,
  Get,
  Post,
  Put,
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
  async getMyCreditHistory(
    @CurrentUser() user: JwtUser,
    @Query('page') page = '1',
    @Query('limit') limit = '30',
    @Query('startDate') startDate?: string,
  ) {
    if (user.type !== 'reseller') throw new ForbiddenException('Reseller panel access only');
    const start = startDate ? new Date(startDate) : undefined;
    return this.resellerService.getCreditHistory(user.id, +page, +limit, start);
  }

  @Get('me/dashboard')
  @Roles('RESELLER')
  async getMyDashboard(@CurrentUser() user: JwtUser) {
    if (user.type !== 'reseller') throw new ForbiddenException('Reseller panel access only');
    return this.resellerService.getDashboard(user.id);
  }

  @Get('me/packages')
  @Roles('RESELLER')
  async getMyPackages(@CurrentUser() user: JwtUser) {
    if (user.type !== 'reseller') throw new ForbiddenException('Reseller panel access only');
    return this.resellerService.getPackages();
  }

  // me/users — literal routes before :userId param
  @Get('me/users')
  @Roles('RESELLER')
  async getMyUsers(
    @CurrentUser() user: JwtUser,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
    @Query('expiryFilter') expiryFilter?: string,
  ) {
    if (user.type !== 'reseller') throw new ForbiddenException('Reseller panel access only');
    return this.resellerService.getMyUsers(
      user.id, +page, +limit, search, status,
      sortBy, (sortDir === 'asc' ? 'asc' : 'desc'), expiryFilter,
    );
  }

  @Post('me/users/quick-create')
  @Roles('RESELLER')
  async quickCreateUser(
    @CurrentUser() user: JwtUser,
    @Body() body: {
      username?: string;
      password?: string;
      durationDays?: number;
      durationHours?: number;
      maxConnections: number;
      notes?: string;
    },
  ) {
    if (user.type !== 'reseller') throw new ForbiddenException('Reseller panel access only');
    return this.resellerService.quickCreateUser(user.id, body);
  }

  @Post('me/users/bulk')
  @Roles('RESELLER')
  async bulkAction(
    @CurrentUser() user: JwtUser,
    @Body() body: { action: 'extend' | 'suspend' | 'activate'; userIds: string[]; days?: number },
  ) {
    if (user.type !== 'reseller') throw new ForbiddenException('Reseller panel access only');
    return this.resellerService.bulkAction(user.id, body.action, body.userIds, body.days);
  }

  @Post('me/users/:userId/reset-password')
  @Roles('RESELLER')
  async resetUserPassword(@CurrentUser() user: JwtUser, @Param('userId') userId: string) {
    if (user.type !== 'reseller') throw new ForbiddenException('Reseller panel access only');
    return this.resellerService.resetUserPassword(user.id, userId);
  }

  @Get('me/users/:userId/playlists')
  @Roles('RESELLER')
  async getUserPlaylists(@CurrentUser() user: JwtUser, @Param('userId') userId: string) {
    if (user.type !== 'reseller') throw new ForbiddenException('Reseller panel access only');
    return this.resellerService.getUserPlaylists(user.id, userId);
  }

  @Get('me/users/:userId')
  @Roles('RESELLER')
  async getMyUserDetail(@CurrentUser() user: JwtUser, @Param('userId') userId: string) {
    if (user.type !== 'reseller') throw new ForbiddenException('Reseller panel access only');
    return this.resellerService.getMyUserDetail(user.id, userId);
  }

  @Put('me/users/:userId')
  @Roles('RESELLER')
  async updateMyUser(
    @CurrentUser() user: JwtUser,
    @Param('userId') userId: string,
    @Body() body: { maxConnections?: number; expiresAt?: string; notes?: string; status?: string },
  ) {
    if (user.type !== 'reseller') throw new ForbiddenException('Reseller panel access only');
    return this.resellerService.updateMyUser(user.id, userId, body);
  }

  @Delete('me/users/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('RESELLER')
  async deleteMyUser(@CurrentUser() user: JwtUser, @Param('userId') userId: string): Promise<void> {
    if (user.type !== 'reseller') throw new ForbiddenException('Reseller panel access only');
    await this.resellerService.deleteMyUser(user.id, userId);
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
