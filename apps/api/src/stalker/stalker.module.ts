import { Module } from '@nestjs/common';
import { StalkerController } from './stalker.controller';
import { StalkerService } from './stalker.service';
import { MagAdminController } from './mag-admin.controller';
import { Enigma2AdminController } from './enigma2-admin.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [StalkerController, MagAdminController, Enigma2AdminController],
  providers: [StalkerService],
})
export class StalkerModule {}
