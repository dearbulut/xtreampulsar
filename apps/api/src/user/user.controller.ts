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
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from './user.service';
import { UserActivityService } from './user-activity.service';
import { ResellerService } from '../reseller/reseller.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { ActivityQueryDto } from './dto/activity-query.dto';
import { BulkExtendDto, BulkDeleteDto, ExtendDto } from './dto/bulk-user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly userActivityService: UserActivityService,
    private readonly resellerService: ResellerService,
    private readonly prisma: PrismaService,
  ) {}

  // Must be before :id routes
  @Get('expiring')
  findExpiring(@Query('days') days?: string) {
    return this.userService.findExpiring(days ? parseInt(days, 10) : 7);
  }

  @Post('bulk-extend')
  @Roles('ADMIN', 'RESELLER')
  bulkExtend(@Body() dto: BulkExtendDto) {
    return this.userService.bulkExtend(dto.userIds, dto.days);
  }

  @Post('bulk-delete')
  @Roles('ADMIN')
  bulkDelete(@Body() dto: BulkDeleteDto) {
    return this.userService.bulkSoftDelete(dto.userIds);
  }

  @Get()
  @Roles('ADMIN', 'RESELLER')
  findAll(@Query() query: QueryUserDto, @CurrentUser() user: JwtUser) {
    if (user.type === 'reseller') {
      query.resellerId = user.id;
    }
    return this.userService.findAll(query);
  }

  @Post()
  @Roles('ADMIN', 'RESELLER')
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: JwtUser) {
    if (user.type === 'reseller') {
      dto.resellerId = user.id;
      let creditCost = 1;
      if (dto.packageId) {
        const pkg = await this.prisma.package.findUnique({
          where: { id: dto.packageId },
          select: { creditCost: true },
        });
        if (pkg) creditCost = pkg.creditCost;
      }
      await this.resellerService.deductCredits(user.id, creditCost, `Kullanıcı oluşturma: ${dto.username}`);
    }
    return this.userService.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'RESELLER')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.userService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'RESELLER')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.userService.softDelete(id);
  }

  @Post(':id/extend')
  @Roles('ADMIN', 'RESELLER')
  extend(@Param('id') id: string, @Body() dto: ExtendDto) {
    return this.userService.extend(id, dto.days);
  }

  @Post(':id/ban')
  @Roles('ADMIN', 'RESELLER')
  ban(@Param('id') id: string) {
    return this.userService.ban(id);
  }

  @Post(':id/unban')
  @Roles('ADMIN', 'RESELLER')
  unban(@Param('id') id: string) {
    return this.userService.unban(id);
  }

  @Get(':id/connections')
  @Roles('ADMIN', 'RESELLER')
  getConnections(@Param('id') id: string) {
    return this.userService.getActiveConnections(id);
  }

  @Post(':id/kick')
  @Roles('ADMIN', 'RESELLER')
  kick(@Param('id') id: string) {
    return this.userService.kickAll(id);
  }

  @Get(':id/qr')
  @Roles('ADMIN', 'RESELLER')
  generateQr(@Param('id') id: string) {
    return this.userService.generateQrCode(id);
  }

  @Post('bulk-renew')
  @Roles('ADMIN', 'RESELLER')
  bulkRenew(@Body() body: { userIds: string[]; packageId: string }) {
    return this.userService.bulkRenew(body.userIds, body.packageId);
  }

  @Get('expiring-count')
  @Roles('ADMIN')
  getExpiringCount(@Query('days') days?: string) {
    return this.userService.countExpiringSoon(days ? parseInt(days, 10) : 7);
  }

  @Get('report')
  @Roles('ADMIN')
  getReport() {
    return this.userService.getUserReport();
  }

  @Get(':id/stats')
  @Roles('ADMIN', 'RESELLER')
  getStats(@Param('id') id: string) {
    return this.userActivityService.getUserStats(id);
  }

  @Get(':id/activity')
  @Roles('ADMIN', 'RESELLER')
  getActivity(@Param('id') id: string, @Query() query: ActivityQueryDto) {
    return this.userActivityService.getActivityByUser(id, query);
  }
}
