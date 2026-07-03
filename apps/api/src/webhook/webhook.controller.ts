import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('webhooks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Get()
  list() {
    return this.webhookService.listWebhooks();
  }

  @Post()
  create(@Body() dto: { name: string; url: string; secret?: string; events: string[] }) {
    return this.webhookService.createWebhook(dto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: Partial<{ name: string; url: string; secret: string | null; events: string[]; isActive: boolean }>,
  ) {
    return this.webhookService.updateWebhook(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.webhookService.deleteWebhook(id);
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  test(@Param('id') id: string) {
    return this.webhookService.testWebhook(id);
  }
}
