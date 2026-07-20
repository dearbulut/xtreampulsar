import { Module } from '@nestjs/common';
import { ActivationService } from './activation.service';
import { ActivationController } from './activation.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ActivationController],
  providers: [ActivationService],
  exports: [ActivationService],
})
export class ActivationModule {}
