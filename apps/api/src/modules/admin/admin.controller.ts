import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/shared';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiParam, ApiResponse } from '@nestjs/swagger';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { ExtendBusinessSubscriptionDto } from './dto/extend-business-subscription.dto';

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Super admin dashboard — aggregate platform stats' })
  @ApiResponse({ status: 200, description: 'Platform statistics.' })
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('businesses')
  @ApiOperation({ summary: 'List all businesses with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, example: '1' })
  @ApiQuery({ name: 'per_page', required: false, example: '20' })
  @ApiQuery({ name: 'search', required: false, example: 'Heineken' })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'inactive'] })
  @ApiQuery({ name: 'plan', required: false, example: 'free_trial' })
  @ApiResponse({ status: 200, description: 'Paginated businesses list.' })
  async getBusinesses(
    @Query('page') page?: string,
    @Query('per_page') per_page?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('plan') plan?: string,
  ) {
    return this.adminService.getBusinesses({
      page: Math.max(1, Number(page) || 1),
      per_page: Math.min(100, Math.max(1, Number(per_page) || 20)),
      search,
      status,
      plan,
    });
  }

  @Patch('businesses/:id')
  @ApiOperation({ summary: 'Update a business (toggle active, change plan, etc.)' })
  @ApiParam({ name: 'id', description: 'Business UUID' })
  @ApiResponse({ status: 200, description: 'Business updated.' })
  @ApiResponse({ status: 404, description: 'Business not found.' })
  async updateBusiness(@Param('id') id: string, @Body() dto: UpdateBusinessDto) {
    const updated = await this.adminService.updateBusiness(id, dto);
    if (!updated) {
      throw new NotFoundException('Business not found');
    }
    return updated;
  }

  @Post('businesses/extend')
  @ApiOperation({ summary: 'Manually extend/grant a subscription for a business by ID (superadmin only)' })
  @ApiResponse({ status: 200, description: 'Subscription extended.' })
  @ApiResponse({ status: 404, description: 'Business or branch not found.' })
  async extendBusinessSubscription(@Body() dto: ExtendBusinessSubscriptionDto) {
    return this.adminService.extendBusinessSubscription(dto);
  }
}
