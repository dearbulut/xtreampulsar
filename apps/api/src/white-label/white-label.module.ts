import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { WhiteLabelController } from './white-label.controller';
import { WhiteLabelService } from './white-label.service';

@Module({
  imports: [
    MulterModule.register({ limits: { fileSize: 2 * 1024 * 1024 } }),
  ],
  controllers: [WhiteLabelController],
  providers: [WhiteLabelService],
  exports: [WhiteLabelService],
})
export class WhiteLabelModule {}
