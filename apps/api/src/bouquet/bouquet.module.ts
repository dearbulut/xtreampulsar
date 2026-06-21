import { Module } from '@nestjs/common';
import { BouquetController } from './bouquet.controller';
import { BouquetService } from './bouquet.service';

@Module({
  controllers: [BouquetController],
  providers: [BouquetService],
  exports: [BouquetService],
})
export class BouquetModule {}
