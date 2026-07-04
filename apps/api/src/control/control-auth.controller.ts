import { Controller, Post, Get, Body, UseGuards, HttpCode, HttpStatus, Headers } from '@nestjs/common';
import { ControlAuthService } from './control-auth.service';
import { ControlJwtGuard } from './control-jwt.guard';

interface ControlUser {
  id: string;
  username: string;
}

function currentControlUser(req: { user: ControlUser }): ControlUser {
  return req.user;
}

import { Req } from '@nestjs/common';
import type { Request } from 'express';

@Controller('control/auth')
export class ControlAuthController {
  constructor(private readonly authService: ControlAuthService) {}

  @Post('setup')
  @HttpCode(HttpStatus.CREATED)
  setup(
    @Body() dto: { username: string; email: string; password: string },
    @Headers('x-setup-key') setupKey?: string,
  ) {
    return this.authService.setup(dto.username, dto.email, dto.password, setupKey ?? '');
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: { username: string; password: string }) {
    return this.authService.login(dto.username, dto.password);
  }

  @Get('me')
  @UseGuards(ControlJwtGuard)
  me(@Req() req: Request) {
    const user = req.user as ControlUser;
    return this.authService.me(user.id);
  }
}
