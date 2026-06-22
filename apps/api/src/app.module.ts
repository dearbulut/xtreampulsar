import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { LicenseModule } from './license/license.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ResellerModule } from './reseller/reseller.module';
import { PackageModule } from './package/package.module';
import { ServerModule } from './server/server.module';
import { StreamModule } from './stream/stream.module';
import { CategoryModule } from './category/category.module';
import { BouquetModule } from './bouquet/bouquet.module';
import { EpgModule } from './epg/epg.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { MigrationModule } from './migration/migration.module';
import { XtreamModule } from './xtream/xtream.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AppConfigModule,
    PrismaModule,
    RedisModule,
    LicenseModule,
    HealthModule,
    AuthModule,
    UserModule,
    ResellerModule,
    PackageModule,
    ServerModule,
    StreamModule,
    CategoryModule,
    BouquetModule,
    EpgModule,
    AnalyticsModule,
    MigrationModule,
    XtreamModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
