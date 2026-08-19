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
  Request,
  NotFoundException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/shared';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { ExtendBusinessSubscriptionDto } from './dto/extend-business-subscription.dto';
import {
  CreatePlatformPaymentProviderDto,
  UpdatePlatformPaymentProviderDto,
} from './dto/platform-payment-provider.dto';
import {
  CreateShiftTemplateDto,
  UpdateShiftTemplateDto,
} from '../shift/dto/shift-template.dto';

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

  @Get('system/health')
  @ApiOperation({
    summary:
      'Super admin — system health, database connectivity, sync queue status',
  })
  @ApiResponse({ status: 200, description: 'System health snapshot.' })
  async getSystemHealth() {
    return this.adminService.getSystemHealth();
  }

  @Get('revenue')
  @ApiOperation({
    summary:
      'Super admin — platform MRR/ARR and monthly revenue/new-business trend',
  })
  @ApiQuery({ name: 'months', required: false, example: '12' })
  @ApiResponse({ status: 200, description: 'Revenue breakdown.' })
  async getRevenue(@Query('months') months?: string) {
    return this.adminService.getRevenue({
      months: months ? Number(months) : 12,
    });
  }

  @Get('audit-logs')
  @ApiOperation({
    summary: 'Paginated platform-wide audit log entries (superadmin only)',
  })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'user_id', required: false })
  @ApiQuery({ name: 'entity_type', required: false })
  @ApiQuery({ name: 'entity_id', required: false })
  @ApiQuery({ name: 'business_id', required: false })
  @ApiQuery({ name: 'date_from', required: false })
  @ApiQuery({ name: 'date_to', required: false })
  @ApiQuery({ name: 'page', required: false, example: '1' })
  @ApiQuery({ name: 'limit', required: false, example: '50' })
  @ApiResponse({ status: 200, description: 'Paginated audit log entries.' })
  async getAuditLogs(
    @Query('action') action?: string,
    @Query('user_id') userId?: string,
    @Query('entity_type') entityType?: string,
    @Query('entity_id') entityId?: string,
    @Query('business_id') businessId?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAuditLogs({
      action,
      user_id: userId,
      entity_type: entityType,
      entity_id: entityId,
      business_id: businessId,
      date_from: dateFrom,
      date_to: dateTo,
      page: page ? Math.max(1, parseInt(page, 10) || 1) : 1,
      limit: limit ? Math.min(100, Math.max(1, parseInt(limit, 10) || 50)) : 50,
    });
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
  @ApiOperation({
    summary: 'Update a business (toggle active, change plan, etc.)',
  })
  @ApiParam({ name: 'id', description: 'Business UUID' })
  @ApiResponse({ status: 200, description: 'Business updated.' })
  @ApiResponse({ status: 404, description: 'Business not found.' })
  async updateBusiness(
    @Param('id') id: string,
    @Body() dto: UpdateBusinessDto,
  ) {
    const updated = await this.adminService.updateBusiness(id, dto);
    if (!updated) {
      throw new NotFoundException('Business not found');
    }
    return updated;
  }

  @Post('businesses/extend')
  @ApiOperation({
    summary:
      'Manually extend/grant a subscription for a business by ID (superadmin only)',
  })
  @ApiResponse({ status: 200, description: 'Subscription extended.' })
  @ApiResponse({ status: 404, description: 'Business or branch not found.' })
  async extendBusinessSubscription(@Body() dto: ExtendBusinessSubscriptionDto) {
    return this.adminService.extendBusinessSubscription(dto);
  }

  @Get('payment-providers')
  @ApiOperation({
    summary: 'List platform-wide payment providers (superadmin only)',
  })
  @ApiQuery({ name: 'include_inactive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Payment providers.' })
  async listPaymentProviders(
    @Query('include_inactive') includeInactive?: string,
  ) {
    return this.adminService.listPaymentProviders(includeInactive === 'true');
  }

  @Post('payment-providers')
  @ApiOperation({
    summary: 'Create a platform-wide payment provider (superadmin only)',
  })
  @ApiResponse({ status: 201, description: 'Payment provider created.' })
  @ApiResponse({ status: 409, description: 'Provider name already exists.' })
  async createPaymentProvider(@Body() dto: CreatePlatformPaymentProviderDto) {
    return this.adminService.createPaymentProvider(dto);
  }

  @Patch('payment-providers/:id')
  @ApiOperation({
    summary: 'Update a platform-wide payment provider (superadmin only)',
  })
  @ApiParam({ name: 'id', description: 'Payment provider UUID' })
  @ApiResponse({ status: 200, description: 'Payment provider updated.' })
  @ApiResponse({ status: 404, description: 'Payment provider not found.' })
  async updatePaymentProvider(
    @Param('id') id: string,
    @Body() dto: UpdatePlatformPaymentProviderDto,
  ) {
    return this.adminService.updatePaymentProvider(id, dto);
  }

  @Delete('payment-providers/:id')
  @ApiOperation({
    summary: 'Delete a platform-wide payment provider (superadmin only)',
  })
  @ApiParam({ name: 'id', description: 'Payment provider UUID' })
  @ApiResponse({ status: 200, description: 'Payment provider deleted.' })
  @ApiResponse({ status: 404, description: 'Payment provider not found.' })
  async removePaymentProvider(@Param('id') id: string) {
    return this.adminService.removePaymentProvider(id);
  }

  @Get('businesses/:id/shift-templates')
  @ApiOperation({
    summary:
      'List shift templates for a business (superadmin only)',
  })
  @ApiParam({ name: 'id', description: 'Business UUID' })
  @ApiResponse({ status: 200, description: 'Shift templates list.' })
  @ApiResponse({ status: 404, description: 'Business not found.' })
  async listBusinessShiftTemplates(@Param('id') id: string) {
    return this.adminService.listBusinessShiftTemplates(id);
  }

  @Post('businesses/:id/shift-templates')
  @ApiOperation({
    summary:
      'Create a shift template for a business (superadmin only)',
  })
  @ApiParam({ name: 'id', description: 'Business UUID' })
  @ApiResponse({ status: 201, description: 'Shift template created.' })
  @ApiResponse({ status: 404, description: 'Business or branch not found.' })
  async createBusinessShiftTemplate(
    @Param('id') id: string,
    @Body() dto: CreateShiftTemplateDto,
  ) {
    return this.adminService.createBusinessShiftTemplate(id, dto);
  }

  @Patch('businesses/:id/shift-templates/:templateId')
  @ApiOperation({
    summary:
      'Update a shift template for a business (superadmin only)',
  })
  @ApiParam({ name: 'id', description: 'Business UUID' })
  @ApiParam({ name: 'templateId', description: 'Shift template UUID' })
  @ApiResponse({ status: 200, description: 'Shift template updated.' })
  @ApiResponse({ status: 404, description: 'Business or template not found.' })
  async updateBusinessShiftTemplate(
    @Param('id') id: string,
    @Param('templateId') templateId: string,
    @Body() dto: UpdateShiftTemplateDto,
  ) {
    return this.adminService.updateBusinessShiftTemplate(id, templateId, dto);
  }

  @Delete('businesses/:id/shift-templates/:templateId')
  @ApiOperation({
    summary:
      'Delete a shift template for a business (superadmin only)',
  })
  @ApiParam({ name: 'id', description: 'Business UUID' })
  @ApiParam({ name: 'templateId', description: 'Shift template UUID' })
  @ApiResponse({ status: 200, description: 'Shift template deleted.' })
  @ApiResponse({ status: 404, description: 'Business or template not found.' })
  async deleteBusinessShiftTemplate(
    @Param('id') id: string,
    @Param('templateId') templateId: string,
  ) {
    return this.adminService.deleteBusinessShiftTemplate(id, templateId);
  }
}
