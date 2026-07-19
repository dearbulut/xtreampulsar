import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { MigrationController } from './migration.controller';
import { MigrationService } from './migration.service';

@Module({
  imports: [
    MulterModule.register({
      storage: undefined, // use memory storage (default)
    }),
  ],
  controllers: [MigrationController],
  providers: [MigrationService],
  exports: [MigrationService],
})
export class MigrationModule {}
