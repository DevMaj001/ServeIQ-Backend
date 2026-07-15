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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/shared';
import { UserService } from './user.service';
import { CreateWaiterDto } from './dto/create-waiter.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User } from './entities/user.entity';
import { ApiResponse } from '@nestjs/swagger';
import { getPaginationParams, paginate } from '../../common/pagination';

@ApiTags('User')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('waiters')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new waiter' })
  @ApiResponse({ status: 201, description: 'Waiter created.' })
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
  async getProfile(@Request() req: any) {
    return this.userService.findOne(req.user.userId, req.user.branchId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update own user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated.' })
  async updateProfile(@Request() req: any, @Body() dto: UpdateProfileDto) {
    return this.userService.updateProfile(req.user.userId, dto);
  }

  @Get('waiters')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all waiters in the branch' })
  @ApiQuery({ name: 'page', required: false, example: '1' })
  @ApiQuery({ name: 'per_page', required: false, example: '20' })
  @ApiResponse({ status: 200, description: 'List of waiters.', type: [User] })
  async getWaiters(
    @Request() req: { user: { branchId: string } },
    @Query('page') page?: string,
    @Query('per_page') per_page?: string,
  ) {
    const pagination = getPaginationParams({ page, per_page });
    const { data, total } = await this.userService.findAllWaiters(req.user.branchId, pagination);
    return paginate(data, total, pagination);
  }

  @Patch('waiters/:id/reset-pin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Reset waiter PIN' })
  async resetWaiterPin(
    @Request() req: { user: { businessId: string } },
    @Param('id') id: string,
  ) {
    return this.userService.resetWaiterPin(id, req.user.businessId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a user/waiter profile (Owner/Manager only)' })
  @ApiResponse({ status: 200, description: 'User updated.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async update(
    @Request() req: { user: { branchId: string } },
    @Param('id') id: string,
    @Body() updateDto: any,
  ) {
    return this.userService.update(id, req.user.branchId, updateDto);
  }

  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Deactivate a user (soft)' })
  @ApiResponse({ status: 200, description: 'User deactivated.' })
  async deactivateUser(
    @Request() req: { user: { businessId: string } },
    @Param('id') id: string,
  ) {
    return this.userService.deactivateUser(id, req.user.businessId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a waiter' })
  @ApiResponse({ status: 200, description: 'Waiter deleted.' })
  async deleteWaiter(
    @Request() req: { user: { businessId: string } },
    @Param('id') id: string,
  ) {
    return this.userService.removeWaiter(id, req.user.businessId);
  }
}
