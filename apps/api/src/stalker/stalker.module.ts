import { Module } from '@nestjs/common';
import { StalkerController } from './stalker.controller';
import { StalkerService } from './stalker.service';
import { MagAdminController } from './mag-admin.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [StalkerController, MagAdminController],
  providers: [StalkerService],
})
export class StalkerModule {}
