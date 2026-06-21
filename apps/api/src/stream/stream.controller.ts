import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StreamService } from './stream.service';
import { StreamWorkerService } from './stream-worker.service';
import { CreateStreamDto } from './dto/create-stream.dto';
import { UpdateStreamDto } from './dto/update-stream.dto';
import { QueryStreamDto } from './dto/query-stream.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';

@Controller('streams')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StreamController {
  constructor(
    private readonly streamService: StreamService,
    private readonly workerService: StreamWorkerService,
  ) {}

  @Get()
  findAll(@Query() query: QueryStreamDto, @CurrentUser() user: JwtUser) {
    return this.streamService.findAllWithFilters(user.id, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.streamService.findById(id);
  }

  @Post()
  @Roles('ADMIN', 'RESELLER')
  create(@Body() dto: CreateStreamDto) {
    return this.streamService.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'RESELLER')
  update(@Param('id') id: string, @Body() dto: UpdateStreamDto) {
    return this.streamService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.streamService.remove(id);
  }

  @Post(':id/restart')
  @Roles('ADMIN', 'RESELLER')
  async restart(@Param('id') id: string) {
    await this.workerService.restartWorker(id);
    return { message: `Stream ${id} worker restarted` };
  }

  @Get(':id/stats')
  stats(@Param('id') id: string) {
    return this.workerService.getWorkerStats(id);
  }
}
