import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../role/permission-codes';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('Dashboard')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('dashboard/branch')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.VIEW_DASHBOARD)
  @ApiOperation({
    summary: 'Branch overview — totals for tables, open tabs, today revenue',
  })
  @ApiResponse({ status: 200, description: 'Branch overview stats.' })
  async getBranchOverview(@Request() req: any) {
    return this.dashboardService.getBranchOverview(req.user.branchId);
  }

  @Get('dashboard/waiters')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.VIEW_DASHBOARD)
  @ApiOperation({
    summary: 'Waiter performance — tabs closed and revenue today by waiter',
  })
  @ApiResponse({ status: 200, description: 'Waiter performance list.' })
  async getWaiterPerformance(@Request() req: any) {
    return this.dashboardService.getWaiterPerformance(req.user.branchId);
  }

  @Get('reports/sales')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.VIEW_DAILY_SALES)
  @ApiOperation({
    summary:
      'Sales report with optional date range and payment method breakdown',
  })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    example: '2026-06-01',
    description: 'Start date (inclusive). Omit for all-time.',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    example: '2026-06-28',
    description: 'End date (inclusive). Omit for all-time.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sales report data.',
    schema: {
      example: {
        total_revenue_kobo: 52692500,
        transaction_count: 29,
        average_bill_kobo: 1816982,
        breakdown_by_method: { cash: 35000000, transfer: 17692500 },
      },
    },
  })
  async getSalesReport(
    @Request() req: any,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.dashboardService.getSalesReport(
      req.user.branchId,
      dateFrom,
      dateTo,
    );
  }

  @Get('reports/peak-hours')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.VIEW_DAILY_SALES)
  @ApiOperation({ summary: 'Orders and revenue grouped by hour of day' })
  @ApiQuery({ name: 'dateFrom', required: false, example: '2026-06-01' })
  @ApiQuery({ name: 'dateTo', required: false, example: '2026-06-28' })
  @ApiResponse({ status: 200, description: 'Hourly breakdown array (0-23).' })
  async getPeakHours(
    @Request() req: any,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.dashboardService.getPeakHours(
      req.user.branchId,
      dateFrom,
      dateTo,
    );
  }

  @Get('reports/items')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.VIEW_DAILY_SALES)
  @ApiOperation({ summary: 'Top selling items report with date range filter' })
  @ApiQuery({ name: 'dateFrom', required: false, example: '2026-06-01' })
  @ApiQuery({ name: 'dateTo', required: false, example: '2026-06-28' })
  @ApiResponse({ status: 200, description: 'Top items list.' })
  async getTopItems(
    @Request() req: any,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.dashboardService.getTopItems(
      req.user.branchId,
      dateFrom,
      dateTo,
    );
  }

  @Get('reports/table-velocity')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.VIEW_DAILY_SALES)
  @ApiOperation({
    summary: 'Average time between open and close per table (table velocity)',
  })
  @ApiResponse({
    status: 200,
    description: 'Table velocity list sorted by shortest avg duration.',
  })
  async getTableVelocity(@Request() req: any) {
    return this.dashboardService.getTableVelocity(req.user.branchId);
  }

  @Get('reports/peak-efficiency')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.VIEW_DAILY_SALES)
  @ApiOperation({ summary: 'Covers and avg duration grouped by hour of day' })
  @ApiQuery({ name: 'dateFrom', required: false, example: '2026-06-01' })
  @ApiQuery({ name: 'dateTo', required: false, example: '2026-06-28' })
  @ApiResponse({
    status: 200,
    description: 'Hourly efficiency breakdown (0-23).',
  })
  async getPeakEfficiency(
    @Request() req: any,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.dashboardService.getPeakEfficiency(
      req.user.branchId,
      dateFrom,
      dateTo,
    );
  }
}
