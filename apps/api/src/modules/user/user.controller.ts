import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  Delete,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../role/permission-codes';
import { UserRole } from '../../common/shared';
import { UserService } from './user.service';
import { CreateWaiterDto } from './dto/create-waiter.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { getPaginationParams, paginate } from '../../common/pagination';

interface RequestWithUser {
  user: {
    userId: string;
    branchId: string;
    businessId?: string;
  };
}

@ApiTags('User')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('waiters')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @RequirePermissions(PERMISSIONS.CREATE_STAFF)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a waiter or supervisor' })
  @ApiResponse({ status: 201, description: 'User created.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  async createWaiter(
    @Request() req: { user: { businessId: string } },
    @Body() dto: CreateWaiterDto,
  ) {
    return this.userService.createWaiter(dto, req.user.businessId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get own user profile' })
  @ApiResponse({ status: 200, description: 'User profile.', type: User })
  async getProfile(@Request() req: RequestWithUser) {
    return this.userService.findOne(req.user.userId, req.user.branchId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update own user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated.' })
  async updateProfile(
    @Request() req: RequestWithUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(req.user.userId, dto);
  }

  @Get('waiters')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List waiters (or all staff with ?role=all) in the branch',
  })
  @ApiQuery({ name: 'page', required: false, example: '1' })
  @ApiQuery({ name: 'per_page', required: false, example: '20' })
  @ApiQuery({
    name: 'role',
    required: false,
    example: 'all',
    description: 'Pass "all" to include supervisors',
  })
  @ApiResponse({ status: 200, description: 'List of staff.', type: [User] })
  async getWaiters(
    @Request() req: { user: { branchId: string } },
    @Query('page') page?: string,
    @Query('per_page') per_page?: string,
    @Query('role') role?: string,
  ) {
    const pagination = getPaginationParams({ page, per_page });
    const { data, total } = await this.userService.findAllWaiters(
      req.user.branchId,
      pagination,
      role,
    );
    return paginate(data, total, pagination);
  }

  @Patch('waiters/:id/reset-pin')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @RequirePermissions(PERMISSIONS.RESET_PASSWORD)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Reset staff PIN (Owner/Manager only) — works for waiters, supervisors, managers, and chefs',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  async resetWaiterPin(
    @Request() req: { user: { businessId: string } },
    @Param('id') id: string,
  ) {
    return this.userService.resetWaiterPin(id, req.user.businessId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @RequirePermissions(PERMISSIONS.EDIT_STAFF)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update a user/waiter profile (Owner/Manager only)',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User updated.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async update(
    @Request() req: { user: { branchId: string } },
    @Param('id') id: string,
    @Body() updateDto: UpdateUserDto,
  ) {
    return this.userService.update(id, req.user.branchId, updateDto);
  }

  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @RequirePermissions(PERMISSIONS.EDIT_STAFF)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Deactivate a user (Owner/Manager only)' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User deactivated.' })
  async deactivateUser(
    @Request() req: { user: { businessId: string } },
    @Param('id') id: string,
  ) {
    return this.userService.deactivateUser(id, req.user.businessId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @RequirePermissions(PERMISSIONS.DELETE_STAFF)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a user (Owner/Manager only)' })
  @ApiResponse({ status: 200, description: 'User deleted.' })
  async deleteUser(
    @Request() req: { user: { businessId: string } },
    @Param('id') id: string,
  ) {
    return this.userService.removeUser(id, req.user.businessId);
  }
}
