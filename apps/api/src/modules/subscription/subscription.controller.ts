import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { InitializeSubscriptionDto } from './dto/initialize-subscription.dto';
import { AdminGrantDto } from './dto/admin-grant.dto';
import { AdminExtendGraceDto } from './dto/admin-extend-grace.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/shared';

@ApiTags('Subscriptions')
@Controller({ path: 'subscriptions', version: '1' })
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post('initialize')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Initialize a Paystack transaction for a subscription plan' })
  @ApiResponse({ status: 200, description: 'Returns authorization_url for Paystack redirect' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async initialize(@Request() req: any, @Body() dto: InitializeSubscriptionDto) {
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

  @Get('current')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current subscription status for the authenticated branch' })
  @ApiResponse({ status: 200, description: 'Subscription details with plan and timestamps' })
  @ApiResponse({ status: 404, description: 'No subscription found' })
  async getCurrent(@Request() req: any) {
    return this.subscriptionService.getCurrent(req.user.branchId);
  }

  @Post('cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cancel subscription at end of current billing period' })
  @ApiResponse({ status: 200, description: 'Subscription marked as canceled' })
  @ApiResponse({ status: 400, description: 'Subscription is not eligible for cancellation' })
  async cancel(@Request() req: any) {
    return this.subscriptionService.cancel(req.user.branchId);
  }

  @Post('admin/grant')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Manually grant or extend a subscription (superadmin only)' })
  @ApiResponse({ status: 200, description: 'Subscription granted or extended' })
  async adminGrant(@Request() req: any, @Body() dto: AdminGrantDto) {
    return this.subscriptionService.adminGrant(dto);
  }

  @Post('admin/extend-grace')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Extend grace period for a branch subscription (superadmin only)' })
  @ApiResponse({ status: 200, description: 'Grace period extended' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async extendGrace(@Request() req: any, @Body() dto: AdminExtendGraceDto) {
    return this.subscriptionService.extendGracePeriod(dto);
  }
}
