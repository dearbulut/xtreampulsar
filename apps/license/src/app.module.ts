import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LicenseModule } from './license/license.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LicenseModule,
  ],
})
export class AppModule {}
