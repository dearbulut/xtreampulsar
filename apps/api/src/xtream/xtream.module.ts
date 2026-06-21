import { Module } from '@nestjs/common';
import { XtreamController } from './xtream.controller';
import { XtreamService } from './xtream.service';
import { UserModule } from '../user/user.module';
import { StreamModule } from '../stream/stream.module';

@Module({
  imports: [UserModule, StreamModule],
  controllers: [XtreamController],
  providers: [XtreamService],
})
export class XtreamModule {}
