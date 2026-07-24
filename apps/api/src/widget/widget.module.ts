import { Module } from '@nestjs/common';
import { WidgetController } from './widget.controller';
import { WidgetPublicController } from './widget-public.controller';
import { WidgetService } from './widget.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StoreModule } from '../store/store.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [PrismaModule, StoreModule, UserModule],
  controllers: [WidgetController, WidgetPublicController],
  providers: [WidgetService],
  exports: [WidgetService],
})
export class WidgetModule {}
