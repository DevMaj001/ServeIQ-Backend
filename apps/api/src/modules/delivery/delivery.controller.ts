import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Request,
  Body,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../role/permission-codes';
import { UserRole } from '../../common/shared';
import { DeliveryService } from './delivery.service';
import { RiderService } from '../riders/rider.service';
import { PayoutProvider } from './entities/rider-payout.entity';

@ApiTags('Deliveries')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('deliveries')
export class DeliveryController {
  constructor(
    private readonly deliveryService: DeliveryService,
    private readonly riderService: RiderService,
  ) {}

  @Get()
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERADMIN)
  @RequirePermissions(PERMISSIONS.VIEW_DELIVERIES)
  @ApiOperation({ summary: 'List deliveries for a branch (manager view)' })
  async listByBranch(
    @Request() req: any,
    @Query('branch_id') branchId?: string,
    @Query('status') status?: string,
  ) {
    return this.deliveryService.listByBranch(
      branchId || req.user.branchId,
      status,
    );
  }

  @Get('available')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles(UserRole.RIDER)
  @RequirePermissions(PERMISSIONS.ACCEPT_DELIVERY)
  @ApiOperation({
    summary: 'Rider: list available + my deliveries for the branch',
  })
  async available(@Request() req: any) {
    const rider = await this.riderService.findByUserId(req.user.userId);
    return this.deliveryService.listForRider(rider);
  }

  @Get('mine')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles(UserRole.RIDER)
  @RequirePermissions(PERMISSIONS.VIEW_DELIVERIES)
  @ApiOperation({ summary: 'Rider: list my accepted/ongoing deliveries' })
  async mine(@Request() req: any) {
    const rider = await this.riderService.findByUserId(req.user.userId);
    return this.deliveryService.listMine(rider);
  }

  @Post(':id/accept')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles(UserRole.RIDER)
  @RequirePermissions(PERMISSIONS.ACCEPT_DELIVERY)
  @ApiOperation({
    summary: 'Rider: accept an available delivery (first-accept wins)',
  })
  async accept(@Param('id') id: string, @Request() req: any) {
    const rider = await this.riderService.findByUserId(req.user.userId);
    return this.deliveryService.accept(id, rider);
  }

  @Post(':id/delivered')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles(UserRole.RIDER)
  @RequirePermissions(PERMISSIONS.COMPLETE_DELIVERY)
  @ApiOperation({
    summary: 'Rider: mark a delivery as handed over to the customer',
  })
  async complete(@Param('id') id: string, @Request() req: any) {
    const rider = await this.riderService.findByUserId(req.user.userId);
    return this.deliveryService.complete(id, rider);
  }

  @Post(':id/reassign')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERADMIN)
  @RequirePermissions(PERMISSIONS.VIEW_DELIVERIES, PERMISSIONS.MANAGE_RIDERS)
  @ApiOperation({
    summary: 'Manager: reassign an undelivered delivery to a new rider',
  })
  async reassign(@Param('id') id: string, @Request() req: any) {
    return this.deliveryService.reassign(
      id,
      req.user.branchId,
      req.user.userId,
    );
  }

  // ===== RIDER PAYOUT ENDPOINTS (Manager/Owner) =====

  @Get('payouts/pending')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERADMIN)
  @RequirePermissions(PERMISSIONS.VIEW_DELIVERIES, PERMISSIONS.MANAGE_RIDERS)
  @ApiOperation({ summary: 'Get pending payout summary for all riders in branch' })
  async getPendingPayouts(@Request() req: any, @Query('branch_id') branchId?: string) {
    return this.deliveryService.getPendingPayoutsByBranch(branchId || req.user.branchId);
  }

  @Get('riders/:riderId/payouts/pending')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERADMIN, UserRole.RIDER)
  @RequirePermissions(PERMISSIONS.VIEW_DELIVERIES)
  @ApiOperation({ summary: 'Get pending payout details for a specific rider' })
  async getRiderPendingPayouts(@Param('riderId') riderId: string, @Request() req: any) {
    // Riders can only see their own pending payouts
    if (req.user.role === UserRole.RIDER) {
      const rider = await this.riderService.findByUserId(req.user.userId);
      if (rider.id !== riderId) throw new ForbiddenException('Cannot view other riders\' payouts');
    }
    return this.deliveryService.getPendingPayouts(riderId);
  }

  @Get('riders/:riderId/ledger')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERADMIN, UserRole.RIDER)
  @RequirePermissions(PERMISSIONS.VIEW_DELIVERIES)
  @ApiOperation({ summary: 'Get earnings/payout ledger for a rider' })
  async getRiderLedger(@Param('riderId') riderId: string, @Request() req: any, @Query('limit') limit?: number) {
    if (req.user.role === UserRole.RIDER) {
      const rider = await this.riderService.findByUserId(req.user.userId);
      if (rider.id !== riderId) throw new ForbiddenException('Cannot view other riders\' ledger');
    }
    return this.deliveryService.getRiderLedger(riderId, limit ? Number(limit) : 100);
  }

  @Get('riders/:riderId/payout-batches')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERADMIN, UserRole.RIDER)
  @RequirePermissions(PERMISSIONS.VIEW_DELIVERIES)
  @ApiOperation({ summary: 'Get payout batch history for a rider' })
  async getRiderPayoutBatches(@Param('riderId') riderId: string, @Request() req: any, @Query('limit') limit?: number) {
    if (req.user.role === UserRole.RIDER) {
      const rider = await this.riderService.findByUserId(req.user.userId);
      if (rider.id !== riderId) throw new ForbiddenException('Cannot view other riders\' batches');
    }
    return this.deliveryService.getRiderPayoutBatches(riderId, limit ? Number(limit) : 50);
  }

  @Get('payout-batches')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERADMIN)
  @RequirePermissions(PERMISSIONS.VIEW_DELIVERIES, PERMISSIONS.MANAGE_RIDERS)
  @ApiOperation({ summary: 'Get all payout batches for the business (admin view)' })
  async getBusinessPayoutBatches(@Request() req: any, @Query('limit') limit?: number) {
    return this.deliveryService.getBusinessPayoutBatches(req.user.businessId, limit ? Number(limit) : 100);
  }

  @Post('riders/:riderId/payout')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERADMIN)
  @RequirePermissions(PERMISSIONS.MANAGE_RIDERS)
  @ApiOperation({ summary: 'Process payout for a rider (creates batch, marks deliveries paid)' })
  async processRiderPayout(
    @Param('riderId') riderId: string,
    @Request() req: any,
    @Body() body: { provider?: string; providerBatchId?: string },
  ) {
    return this.deliveryService.processRiderPayout(
      riderId,
      req.user.businessId,
      req.user.userId,
      (body.provider as PayoutProvider) || PayoutProvider.MANUAL,
      body.providerBatchId,
    );
  }

  @Post('payout-batches/:batchId/complete')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERADMIN)
  @RequirePermissions(PERMISSIONS.MANAGE_RIDERS)
  @ApiOperation({ summary: 'Mark a payout batch as completed (after bank transfer succeeds)' })
  async completePayoutBatch(@Param('batchId') batchId: string, @Body() body: { providerBatchId: string }) {
    return this.deliveryService.completePayoutBatch(batchId, body.providerBatchId);
  }

  @Post('payout-batches/:batchId/fail')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERADMIN)
  @RequirePermissions(PERMISSIONS.MANAGE_RIDERS)
  @ApiOperation({ summary: 'Mark a payout batch as failed' })
  async failPayoutBatch(@Param('batchId') batchId: string, @Body() body: { reason: string }) {
    return this.deliveryService.failPayoutBatch(batchId, body.reason);
  }
}
