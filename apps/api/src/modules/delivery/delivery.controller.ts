import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Request,
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
}
