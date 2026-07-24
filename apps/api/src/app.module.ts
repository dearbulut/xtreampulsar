import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DemoModeGuard } from './common/demo-mode.guard';
import { PanelGeoBlockGuard } from './security/panel-geo-block.guard';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { LicenseModule } from './license/license.module';
import { LicenseGuard } from './license/license.guard';
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
import { MonitorModule } from './monitor/monitor.module';
import { InvoiceModule } from './invoice/invoice.module';
import { SubtitleModule } from './subtitle/subtitle.module';
import { CommissionModule } from './commission/commission.module';
import { SecurityModule } from './security/security.module';
import { StalkerModule } from './stalker/stalker.module';
import { ApiKeyModule } from './api-key/api-key.module';
import { UpdateModule } from './update/update.module';
import { WhiteLabelModule } from './white-label/white-label.module';
import { MetadataModule } from './metadata/metadata.module';
import { ActivationModule } from './activation/activation.module';
import { StoreModule } from './store/store.module';
import { SearchModule } from './search/search.module';
import { WebhookModule } from './webhook/webhook.module';
import { ControlModule } from './control/control.module';
import { SupportModule } from './support/support.module';
import { ClientModule } from './client/client.module';
import { ClientRequestsModule } from './client-requests/client-requests.module';
import { M3uSyncModule } from './m3u-sync/m3u-sync.module';
import { ProviderModule } from './provider/provider.module';
import { WidgetModule } from './widget/widget.module';
import { WatchFolderModule } from './watch-folder/watch-folder.module';
import { ResellerApiModule } from './reseller-api/reseller-api.module';
import { DownloadModule } from './download/download.module';
import { CatchupModule } from './catchup/catchup.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 600 }]),
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
    MonitorModule,
    InvoiceModule,
    SubtitleModule,
    CommissionModule,
    SecurityModule,
    StalkerModule,
    ApiKeyModule,
    UpdateModule,
    WhiteLabelModule,
    MetadataModule,
    ActivationModule,
    StoreModule,
    SearchModule,
    WebhookModule,
    ControlModule,
    SupportModule,
    ClientModule,
    ClientRequestsModule,
    M3uSyncModule,
    ProviderModule,
    WidgetModule,
    WatchFolderModule,
    ResellerApiModule,
    DownloadModule,
    CatchupModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: DemoModeGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: PanelGeoBlockGuard },
    { provide: APP_GUARD, useClass: LicenseGuard },
  ],
})
export class AppModule {}
