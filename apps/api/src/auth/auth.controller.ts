import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.socket?.remoteAddress ?? '';
    const ua = req.headers['user-agent'] ?? '';
    return this.authService.login(dto, ip, ua);
  }

  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  verifyTwoFactor(@Body() dto: { tempToken: string; code: string }) {
    return this.authService.verifyTwoFactor(dto.tempToken, dto.code);
  }

  @Get('2fa/setup')
  @UseGuards(JwtAuthGuard)
  setupTwoFactor(@CurrentUser() user: JwtUser) {
    return this.twoFactorService.generateSetup(user.id);
  }

  @Get('2fa/forced-setup')
  forcedSetupGenerate(@Query('setupToken') setupToken: string) {
    return this.authService.forcedSetupGenerate(setupToken);
  }

  @Post('2fa/forced-setup')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  forcedSetupEnable(@Body() dto: { setupToken: string; code: string }) {
    return this.authService.forcedSetupEnable(dto.setupToken, dto.code);
  }

  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async enableTwoFactor(@CurrentUser() user: JwtUser, @Body() dto: { code: string }) {
    await this.twoFactorService.enableTwoFactor(user.id, dto.code);
    return { enabled: true };
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async disableTwoFactor(@CurrentUser() user: JwtUser, @Body() dto: { password: string }) {
    await this.twoFactorService.disableTwoFactor(user.id, dto.password);
    return { disabled: true };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  @Patch('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  changePassword(
    @CurrentUser() user: JwtUser,
    @Body() dto: { currentPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtUser) {
    return this.authService.me(user.id);
  }

  @Post('reseller/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  resellerLogin(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.socket?.remoteAddress ?? '';
    return this.authService.resellerLogin(dto, ip);
  }

  @Post('reseller/refresh')
  @HttpCode(HttpStatus.OK)
  resellerRefresh(@Body() dto: RefreshTokenDto) {
    return this.authService.resellerRefresh(dto.refreshToken);
  }

  @Post('reseller/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resellerLogout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.resellerLogout(dto.refreshToken);
  }
}
