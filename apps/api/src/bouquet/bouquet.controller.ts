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
import { BouquetService } from './bouquet.service';
import { CreateBouquetDto } from './dto/create-bouquet.dto';
import { UpdateBouquetDto } from './dto/update-bouquet.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@Controller('bouquets')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class BouquetController {
  constructor(private readonly bouquetService: BouquetService) {}

  @Get()
  findAll() {
    return this.bouquetService.findAll();
  }

  @Get('content-counts')
  contentCounts() {
    return this.bouquetService.contentCounts();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bouquetService.findById(id);
  }

  @Post()
  @Roles('ADMIN')
  @RequirePermission('bouquets.manage')
  create(@Body() dto: CreateBouquetDto) {
    return this.bouquetService.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @RequirePermission('bouquets.manage')
  update(@Param('id') id: string, @Body() dto: UpdateBouquetDto) {
    return this.bouquetService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('bouquets.manage')
  async remove(@Param('id') id: string): Promise<void> {
    await this.bouquetService.remove(id);
  }

  @Post(':id/resign')
  @Roles('ADMIN')
  @RequirePermission('bouquets.manage')
  resign(@Param('id') id: string) {
    return this.bouquetService.resign(id);
  }

  @Post(':id/clone')
  @Roles('ADMIN')
  @RequirePermission('bouquets.manage')
  clone(@Param('id') id: string) {
    return this.bouquetService.clone(id);
  }
}
