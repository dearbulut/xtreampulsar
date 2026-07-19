import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ResellerApiKeyService } from './reseller-api-key.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';

@Controller('reseller-api-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('RESELLER')
export class ResellerApiKeysController {
  constructor(private readonly keys: ResellerApiKeyService) {}

  private ensure(user: JwtUser) {
    if (user.type !== 'reseller') throw new ForbiddenException('Reseller panel access only');
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() body: { name?: string }) {
    this.ensure(user);
    return this.keys.create(user.id, body.name ?? 'API Key');
  }

  @Get()
  list(@CurrentUser() user: JwtUser) {
    this.ensure(user);
    return this.keys.list(user.id);
  }

  @Delete(':id')
  revoke(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    this.ensure(user);
    return this.keys.revoke(user.id, id);
  }
}
