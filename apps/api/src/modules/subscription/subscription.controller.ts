import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { InitializeSubscriptionDto } from './dto/initialize-subscription.dto';
import { AdminGrantDto } from './dto/admin-grant.dto';
import { AdminExtendGraceDto } from './dto/admin-extend-grace.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/create-plan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../role/permission-codes';

@ApiTags('Subscriptions')
@Controller({ path: 'subscriptions', version: '1' })
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post('initialize')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Initialize a Paystack transaction for a subscription plan',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns authorization_url for Paystack redirect',
  })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async initialize(
    @Request() req: any,
    @Body() dto: InitializeSubscriptionDto,
  ) {
    return this.subscriptionService.initialize(req.user.branchId, dto.plan_id);
  }

  @Get('plans')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all available subscription plans' })
  @ApiResponse({ status: 200, description: 'List of plans' })
  async getPlans() {
    return this.subscriptionService.getPlans();
  }

  @Get('admin/plans')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.MANAGE_SUBSCRIPTION)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all plans including inactive (superadmin)' })
  @ApiResponse({ status: 200, description: 'List of all plans' })
  async getAllPlans() {
    return this.subscriptionService.getPlans(true);
  }

  @Post('admin/plans')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.MANAGE_SUBSCRIPTION)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new subscription plan (superadmin)' })
  @ApiResponse({ status: 201, description: 'Plan created' })
  @ApiResponse({
    status: 409,
    description: 'Plan name already exists for currency',
  })
  async createPlan(@Body() dto: CreatePlanDto) {
    return this.subscriptionService.createPlan(dto);
  }

  @Patch('admin/plans/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.MANAGE_SUBSCRIPTION)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a subscription plan (superadmin)' })
  @ApiResponse({ status: 200, description: 'Plan updated' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.subscriptionService.updatePlan(id, dto);
  }

  @Patch('admin/plans/:id/toggle')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.MANAGE_SUBSCRIPTION)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Toggle plan active/inactive (superadmin)' })
  @ApiResponse({ status: 200, description: 'Plan toggled' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async togglePlan(@Param('id') id: string) {
    return this.subscriptionService.togglePlanActive(id);
  }

  @Delete('admin/plans/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.MANAGE_SUBSCRIPTION)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a subscription plan (superadmin)' })
  @ApiResponse({ status: 200, description: 'Plan deleted' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async deletePlan(@Param('id') id: string) {
    return this.subscriptionService.deletePlan(id);
  }

  @Get('current')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get current subscription status for the authenticated branch',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription details with plan and timestamps',
  })
  @ApiResponse({ status: 404, description: 'No subscription found' })
  async getCurrent(@Request() req: any) {
    return this.subscriptionService.getCurrent(req.user.branchId);
  }

  @Post('cancel')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.MANAGE_SUBSCRIPTION)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cancel subscription (Owner only)' })
  @ApiResponse({ status: 200, description: 'Subscription marked as canceled' })
  @ApiResponse({
    status: 400,
    description: 'Subscription is not eligible for cancellation',
  })
  async cancel(@Request() req: any) {
    return this.subscriptionService.cancel(req.user.branchId);
  }

  @Post('admin/grant')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.MANAGE_SUBSCRIPTION)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Manually grant or extend a subscription (superadmin only)',
  })
  @ApiResponse({ status: 200, description: 'Subscription granted or extended' })
  async adminGrant(@Request() req: any, @Body() dto: AdminGrantDto) {
    return this.subscriptionService.adminGrant(dto);
  }

  @Post('admin/extend-grace')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.MANAGE_SUBSCRIPTION)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Extend grace period for a branch subscription (superadmin only)',
  })
  @ApiResponse({ status: 200, description: 'Grace period extended' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async extendGrace(@Request() req: any, @Body() dto: AdminExtendGraceDto) {
    return this.subscriptionService.extendGracePeriod(dto);
  }
}
