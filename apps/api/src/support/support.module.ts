import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';

@Module({
  imports: [HttpModule.register({ timeout: 10_000 })],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
