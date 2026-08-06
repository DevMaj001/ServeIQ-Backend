import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  Request,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/shared';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from './permission-codes';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';

interface RequestWithUser {
  user: {
    role: string;
    role_id: string;
  };
}
@ApiTags('Roles & Permissions')
@Controller('roles')
export class RoleController {
  constructor(
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepo: Repository<Permission>,
  ) {}

  @Get('my-permissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get all permission codes for the current user' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  async getMyPermissions(
    @Request() req: RequestWithUser,
  ): Promise<{ permissions: string[] }> {
    if (req.user.role === 'superadmin' || req.user.role === 'owner') {
      const all = await this.permissionRepo.find({ select: { code: true } });
      return { permissions: all.map((p) => p.code) };
    }

    if (!req.user.role_id) {
      return { permissions: [] };
    }

    const role = await this.roleRepo.findOne({
      where: { id: req.user.role_id },
      relations: { permissions: true },
    });
    if (!role) return { permissions: [] };

    return { permissions: role.permissions.map((p) => p.code) };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER)
  @RequirePermissions(PERMISSIONS.ASSIGN_ROLES)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all roles with their permissions' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  async listRoles(): Promise<Role[]> {
    return this.roleRepo.find({ relations: { permissions: true } });
  }

  @Get('permissions')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER)
  @RequirePermissions(PERMISSIONS.ASSIGN_ROLES)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List all available permissions grouped by category',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  async listPermissions(): Promise<Permission[]> {
    return this.permissionRepo.find({
      order: { category: 'ASC', code: 'ASC' },
    });
  }

  @Put(':id/permissions')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER)
  @RequirePermissions(PERMISSIONS.ASSIGN_ROLES)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update permissions for a role (Owner only)' })
  @ApiParam({ name: 'id', description: 'Role UUID' })
  @ApiResponse({ status: 200, description: 'Permissions updated.' })
  @ApiResponse({ status: 404, description: 'Role not found.' })
  async updateRolePermissions(
    @Param('id') id: string,
    @Body() body: { permission_ids: string[] },
  ): Promise<Role> {
    const role = await this.roleRepo.findOne({
      where: { id },
      relations: { permissions: true },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (role.is_system && role.name === 'Owner') {
      throw new BadRequestException(
        'The Owner role is a protected system role that always has all permissions. It cannot be modified.',
      );
    }

    const permissions = await this.permissionRepo.find({
      where: body.permission_ids.map((id) => ({ id })),
    });
    role.permissions = permissions;
    return this.roleRepo.save(role);
  }
}
