import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ServerModule } from './server/server.module';
import { StreamModule } from './stream/stream.module';
import { CategoryModule } from './category/category.module';
import { BouquetModule } from './bouquet/bouquet.module';
import { XtreamModule } from './xtream/xtream.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    UserModule,
    ServerModule,
    StreamModule,
    CategoryModule,
    BouquetModule,
    XtreamModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
