import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserActivityService } from './user-activity.service';
import { UserRepository } from './user.repository';
import { ResellerModule } from '../reseller/reseller.module';
import { StreamModule } from '../stream/stream.module';
import { PlaylistService } from './playlist/playlist.service';
import { UserPlaylistController, PublicPlaylistController } from './playlist/playlist.controller';
import { WebhookModule } from '../webhook/webhook.module';

@Module({
  imports: [ResellerModule, ScheduleModule, StreamModule, WebhookModule],
  controllers: [UserController, UserPlaylistController, PublicPlaylistController],
  providers: [UserService, UserActivityService, UserRepository, PlaylistService],
  exports: [UserService, UserActivityService],
})
export class UserModule {}
