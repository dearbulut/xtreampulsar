import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BouquetService } from './bouquet.service';
import { CreateBouquetDto } from './dto/create-bouquet.dto';
import { UpdateBouquetDto } from './dto/update-bouquet.dto';
import { ManageStreamsDto } from './dto/manage-streams.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('bouquets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BouquetController {
  constructor(private readonly bouquetService: BouquetService) {}

  @Get()
  findAll() {
    return this.bouquetService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bouquetService.findById(id);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateBouquetDto) {
    return this.bouquetService.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateBouquetDto) {
    return this.bouquetService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.bouquetService.remove(id);
  }

  @Get(':id/streams')
  getBouquetStreams(@Param('id') id: string) {
    return this.bouquetService.getBouquetStreams(id);
  }

  @Put(':id/streams')
  @Roles('ADMIN', 'RESELLER')
  replaceStreams(@Param('id') id: string, @Body() dto: ManageStreamsDto) {
    return this.bouquetService.replaceStreams(id, dto.streamIds);
  }

  @Post(':id/streams')
  @Roles('ADMIN', 'RESELLER')
  setStreams(@Param('id') id: string, @Body() dto: ManageStreamsDto) {
    return this.bouquetService.setStreams(id, dto.streamIds);
  }

  @Post(':id/resign')
  @Roles('ADMIN')
  resign(@Param('id') id: string) {
    return this.bouquetService.resign(id);
  }
}
