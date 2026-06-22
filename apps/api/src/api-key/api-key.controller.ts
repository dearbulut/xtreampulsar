import { Controller, Get, Post, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';

@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  create(
    @CurrentUser() user: JwtUser,
    @Body() dto: { name: string; permissions?: string[]; expiresAt?: string },
  ) {
    return this.apiKeyService.create(
      user.id,
      dto.name,
      dto.permissions ?? ['read'],
      dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    );
  }

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.apiKeyService.list(user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: JwtUser): Promise<void> {
    await this.apiKeyService.delete(id, user.id);
  }
}
