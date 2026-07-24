import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

interface GroupBody {
  name?: string;
  description?: string | null;
  isAdmin?: boolean;
  isReseller?: boolean;
  isBanned?: boolean;
  permissions?: string[];
}

@Controller('rbac')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('ADMIN')
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  @Get('catalog')
  catalog() {
    return this.rbac.getCatalog();
  }

  @Get('groups')
  @RequirePermission('groups.manage')
  list() {
    return this.rbac.listGroups();
  }

  @Get('groups/:id')
  @RequirePermission('groups.manage')
  get(@Param('id') id: string) {
    return this.rbac.getGroup(id);
  }

  @Post('groups')
  @RequirePermission('groups.manage')
  create(@Body() body: GroupBody) {
    return this.rbac.createGroup(body);
  }

  @Patch('groups/:id')
  @RequirePermission('groups.manage')
  update(@Param('id') id: string, @Body() body: GroupBody) {
    return this.rbac.updateGroup(id, body);
  }

  @Delete('groups/:id')
  @RequirePermission('groups.manage')
  remove(@Param('id') id: string) {
    return this.rbac.deleteGroup(id);
  }
}
