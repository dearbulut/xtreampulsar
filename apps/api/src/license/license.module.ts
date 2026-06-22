import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LicenseService } from './license.service';
import { LicenseGuard } from './license.guard';
import { LicenseController } from './license.controller';

@Module({
  imports: [HttpModule],
  providers: [LicenseService, LicenseGuard],
  controllers: [LicenseController],
  exports: [LicenseService, LicenseGuard],
})
export class LicenseModule {}
