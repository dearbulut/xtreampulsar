import { Controller, Get, UseGuards } from '@nestjs/common';
import { ClientService } from './client.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';

@Controller('client')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('USER')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Get('me')
  getMe(@CurrentUser() user: JwtUser) {
    return this.clientService.getMe(user.id);
  }

  @Get('me/connections')
  getConnections(@CurrentUser() user: JwtUser) {
    return this.clientService.getConnections(user.id);
  }
}
