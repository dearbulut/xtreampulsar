import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ResellerModule } from '../reseller/reseller.module';
import { ResellerApiController } from './reseller-api.controller';
import { ResellerApiKeysController } from './reseller-api-keys.controller';
import { ResellerApiService } from './reseller-api.service';
import { ResellerApiKeyService } from './reseller-api-key.service';
import { ResellerApiKeyGuard } from './reseller-api-key.guard';

@Module({
  imports: [PrismaModule, ResellerModule],
  controllers: [ResellerApiController, ResellerApiKeysController],
  providers: [ResellerApiService, ResellerApiKeyService, ResellerApiKeyGuard],
})
export class ResellerApiModule {}
