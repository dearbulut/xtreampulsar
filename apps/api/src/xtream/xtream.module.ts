import { Module } from '@nestjs/common';
import { XtreamController } from './xtream.controller';
import { XtreamService } from './xtream.service';
import { UserModule } from '../user/user.module';
import { StreamModule } from '../stream/stream.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [UserModule, StreamModule, GatewayModule],
  controllers: [XtreamController],
  providers: [XtreamService],
})
export class XtreamModule {}
