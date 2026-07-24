import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { FeaturedService } from './featured.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

interface EventBody {
  title?: string;
  description?: string | null;
  logoUrl?: string | null;
  startsAt?: string | null;
  streamId?: string | null;
  categoryId?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

// Public: oynaticilar/website icin aktif etkinlik listesi
@Controller('public/featured')
export class FeaturedPublicController {
  constructor(private readonly featured: FeaturedService) {}

  @Get()
  list() {
    return this.featured.listPublic();
  }
}

@Controller('featured')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class FeaturedController {
  constructor(private readonly featured: FeaturedService) {}

  @Get()
  list() {
    return this.featured.listAll();
  }

  @Post()
  create(@Body() body: EventBody) {
    return this.featured.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: EventBody) {
    return this.featured.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.featured.remove(id);
  }
}
