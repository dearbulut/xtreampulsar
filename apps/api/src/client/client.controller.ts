import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ClientService } from './client.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { CreateClientRequestDto } from './dto/create-client-request.dto';

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

  @Post('requests')
  createRequest(@CurrentUser() user: JwtUser, @Body() dto: CreateClientRequestDto) {
    return this.clientService.createRequest(user.id, dto);
  }

  @Get('me/requests')
  getMyRequests(@CurrentUser() user: JwtUser) {
    return this.clientService.getMyRequests(user.id);
  }

  @Post('me/requests/:id/messages')
  addRequestMessage(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body('body') body: string) {
    return this.clientService.addMyRequestMessage(user.id, id, body);
  }
}
