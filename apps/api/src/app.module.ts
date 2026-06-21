import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { StreamModule } from './stream/stream.module';
import { XtreamModule } from './xtream/xtream.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    HealthModule,
    UserModule,
    StreamModule,
    XtreamModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
