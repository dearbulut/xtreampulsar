import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserActivityService } from './user-activity.service';
import { UserRepository } from './user.repository';
import { ResellerModule } from '../reseller/reseller.module';

@Module({
  imports: [ResellerModule, ScheduleModule],
  controllers: [UserController],
  providers: [UserService, UserActivityService, UserRepository],
  exports: [UserService, UserActivityService],
})
export class UserModule {}
