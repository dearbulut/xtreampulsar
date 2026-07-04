import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { ControlJwtStrategy } from './control-jwt.strategy';
import { ControlAuthService } from './control-auth.service';
import { ControlAuthController } from './control-auth.controller';
import { ControlDashboardController } from './control-dashboard.controller';
import { ControlCustomersService } from './control-customers.service';
import { ControlCustomersController } from './control-customers.controller';
import { ControlLicensesService } from './control-licenses.service';
import { ControlLicensesController } from './control-licenses.controller';
import { ControlTicketsService } from './control-tickets.service';
import { ControlTicketsController } from './control-tickets.controller';
import { ControlInvoicesService } from './control-invoices.service';
import { ControlInvoicesController } from './control-invoices.controller';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.CONTROL_JWT_SECRET || 'control-jwt-fallback-secret',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [
    ControlAuthController,
    ControlDashboardController,
    ControlCustomersController,
    ControlLicensesController,
    ControlTicketsController,
    ControlInvoicesController,
  ],
  providers: [
    ControlJwtStrategy,
    ControlAuthService,
    ControlCustomersService,
    ControlLicensesService,
    ControlTicketsService,
    ControlInvoicesService,
  ],
})
export class ControlModule {}
