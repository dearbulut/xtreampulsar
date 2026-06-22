import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ServerService } from './server.service';
import { ServerHealthService } from './server-health.service';
import { LoadBalancerService } from './load-balancer.service';
import { CreateServerDto } from './dto/create-server.dto';
import { UpdateServerDto } from './dto/update-server.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('servers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServerController {
  constructor(
    private readonly serverService: ServerService,
    private readonly healthService: ServerHealthService,
    private readonly lbService: LoadBalancerService,
  ) {}

  @Get()
  findAll() {
    return this.serverService.findAll();
  }

  @Get('load')
  getLoad() {
    return this.lbService.getLoadStats();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.serverService.findById(id);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateServerDto) {
    return this.serverService.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateServerDto) {
    return this.serverService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.serverService.remove(id);
  }

  @Get(':id/health')
  async health(@Param('id') id: string) {
    const server = await this.serverService.findById(id);
    const result = await this.healthService.probeOne(server.id);
    return {
      server: { id: server.id, ip: server.ip, port: server.port },
      ...result,
    };
  }
}
