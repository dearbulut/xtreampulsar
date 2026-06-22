import { Module } from '@nestjs/common';
import { XtreamController } from './xtream.controller';
import { XtreamService } from './xtream.service';
import { UserModule } from '../user/user.module';
import { StreamModule } from '../stream/stream.module';
import { GatewayModule } from '../gateway/gateway.module';
import { SecurityModule } from '../security/security.module';
import { ServerModule } from '../server/server.module';

@Module({
  imports: [UserModule, StreamModule, GatewayModule, SecurityModule, ServerModule],
  controllers: [XtreamController],
  providers: [XtreamService],
})
export class XtreamModule {}
