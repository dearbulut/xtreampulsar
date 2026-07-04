import { Module } from '@nestjs/common';
import { XtreamController } from './xtream.controller';
import { XtreamAdminController } from './xtream-admin.controller';
import { XtreamService } from './xtream.service';
import { UserModule } from '../user/user.module';
import { StreamModule } from '../stream/stream.module';
import { GatewayModule } from '../gateway/gateway.module';
import { SecurityModule } from '../security/security.module';
import { ServerModule } from '../server/server.module';
import { WebhookModule } from '../webhook/webhook.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [UserModule, StreamModule, GatewayModule, SecurityModule, ServerModule, WebhookModule, SettingsModule],
  controllers: [XtreamController, XtreamAdminController],
  providers: [XtreamService],
})
export class XtreamModule {}
