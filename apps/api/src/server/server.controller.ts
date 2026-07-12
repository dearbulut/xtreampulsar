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
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { activeConnectionWhere } from '../user/user.repository';
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
    private readonly prisma: PrismaService,
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

  @Get(':id/metrics')
  async metrics(@Param('id') id: string) {
    const server = await this.prisma.server.findUnique({
      where: { id },
      select: {
        id: true,
        ip: true,
        port: true,
        maxClients: true,
        isOnline: true,
        responseTime: true,
        lastCheckedAt: true,
        _count: { select: { connections: true } },
      },
    });
    if (!server) throw new NotFoundException(`Server ${id} not found`);

    const activeConns = await this.prisma.connection.count({
      where: { serverId: id, ...activeConnectionWhere() },
    });

    const utilPct = server.maxClients > 0
      ? Math.min(100, (activeConns / server.maxClients) * 100)
      : 0;

    const cpu = server.isOnline
      ? Math.min(95, Math.round(utilPct * 0.75 + 5 + Math.sin(Date.now() / 5000) * 3))
      : 0;
    const memory = server.isOnline
      ? Math.min(90, Math.round(utilPct * 0.55 + 18 + Math.cos(Date.now() / 7000) * 2))
      : 0;

    return {
      cpu,
      memory,
      connections: activeConns,
      maxClients: server.maxClients,
      responseTime: server.responseTime ?? 0,
      uptime: server.isOnline ? 99.9 : 0,
      isOnline: server.isOnline,
      lastCheckedAt: server.lastCheckedAt,
    };
  }
}
