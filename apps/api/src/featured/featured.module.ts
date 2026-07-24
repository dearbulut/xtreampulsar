import { Module } from '@nestjs/common';
import { FeaturedService } from './featured.service';
import { FeaturedController, FeaturedPublicController } from './featured.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FeaturedController, FeaturedPublicController],
  providers: [FeaturedService],
})
export class FeaturedModule {}
