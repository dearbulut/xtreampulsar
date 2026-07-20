import { Module } from '@nestjs/common';
import { ClientController } from './client.controller';
import { ClientService } from './client.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { ActivationModule } from '../activation/activation.module';

@Module({
  imports: [PrismaModule, SettingsModule, ActivationModule],
  controllers: [ClientController],
  providers: [ClientService],
})
export class ClientModule {}
