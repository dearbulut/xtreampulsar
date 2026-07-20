import { Module } from '@nestjs/common';
import { ResellerController } from './reseller.controller';
import { ResellerService } from './reseller.service';
import { ResellerNotificationService } from './reseller-notification.service';
import { CommissionModule } from '../commission/commission.module';

@Module({
  imports: [CommissionModule],
  controllers: [ResellerController],
  providers: [ResellerService, ResellerNotificationService],
  exports: [ResellerService, ResellerNotificationService],
})
export class ResellerModule {}
