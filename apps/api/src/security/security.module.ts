import { Module } from '@nestjs/common';
import { SecurityService } from './security.service';
import { SecurityController } from './security.controller';
import { PanelGeoBlockGuard } from './panel-geo-block.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SecurityController],
  providers: [SecurityService, PanelGeoBlockGuard],
  exports: [SecurityService, PanelGeoBlockGuard],
})
export class SecurityModule {}
