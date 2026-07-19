import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ResellerApiService } from './reseller-api.service';
import { ResellerApiKeyGuard } from './reseller-api-key.guard';

interface ApiReq { resellerApiKey: { resellerId: string } }

@Controller('reseller-api')
@UseGuards(ResellerApiKeyGuard)
export class ResellerApiController {
  constructor(private readonly api: ResellerApiService) {}

  private rid(req: ApiReq): string {
    return req.resellerApiKey.resellerId;
  }

  @Get('me')
  me(@Req() req: ApiReq) {
    return this.api.me(this.rid(req));
  }

  @Get('packages')
  packages() {
    return this.api.packages();
  }

  @Get('users')
  users(@Req() req: ApiReq, @Query('search') search?: string) {
    return this.api.users(this.rid(req), search);
  }

  @Post('users')
  createUser(
    @Req() req: ApiReq,
    @Body() body: { username?: string; password?: string; packageId?: string; durationDays?: number; maxConnections?: number; notes?: string },
  ) {
    return this.api.createUser(this.rid(req), body);
  }

  @Get('users/:username')
  getUser(@Req() req: ApiReq, @Param('username') username: string) {
    return this.api.getUser(this.rid(req), username);
  }

  @Post('users/:username/extend')
  extend(@Req() req: ApiReq, @Param('username') username: string, @Body() body: { days: number }) {
    return this.api.extend(this.rid(req), username, Number(body.days));
  }

  @Post('users/:username/status')
  status(@Req() req: ApiReq, @Param('username') username: string, @Body() body: { status: string }) {
    return this.api.setStatus(this.rid(req), username, body.status);
  }

  @Delete('users/:username')
  remove(@Req() req: ApiReq, @Param('username') username: string) {
    return this.api.remove(this.rid(req), username);
  }
}
