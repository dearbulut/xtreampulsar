import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { ToolsModule } from './tools/tools.module';
import { SettingsModule } from './settings/settings.module';
import { AuditModule } from './audit/audit.module';
import { GatewayModule } from './gateway/gateway.module';
import { BackupModule } from './backup/backup.module';
import { NotificationModule } from './notification/notification.module';
import { SecurityModule } from './security/security.module';
import { StalkerModule } from './stalker/stalker.module';
import { ApiKeyModule } from './api-key/api-key.module';
import { UpdateModule } from './update/update.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
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
    ToolsModule,
    SettingsModule,
    AuditModule,
    GatewayModule,
    BackupModule,
    NotificationModule,
    SecurityModule,
    StalkerModule,
    ApiKeyModule,
    UpdateModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
