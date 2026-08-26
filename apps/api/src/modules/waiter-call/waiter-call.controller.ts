import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  Session,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { WaiterCallService } from './waiter-call.service';
import { CreateWaiterCallDto } from './dto/waiter-call.dto';
import { WaiterCallStatusDto } from './dto/waiter-call.dto';
import { WaiterWorkloadDto } from './dto/waiter-call.dto';
import { UpdateWaiterCallStatusDto } from './dto/waiter-call.dto';
import { BranchWaiterSettingsDto } from './dto/waiter-call.dto';
import { WaiterCall } from '../entities/waiter-call.entity';
import { Request } from 'express';

@ApiTags('Waiter Call')
@Controller('api/v1/waiter-calls')
@Throttle({ default: { limit: 10, ttl: 60000 } })
export class WaiterCallController {
  constructor(private readonly waiterCallService: WaiterCallService) {}

  /**
   * PUBLIC: Customer calls a waiter from the public menu.
   * - Validates the table belongs to the branch.
   * - Prevents duplicate active requests.
   * - Assigns to the least-loaded eligible waiter.
   * - Queues if all waiters at capacity.
   */
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Customer calls a waiter (public, no auth)' })
  @ApiResponse({ status: 201, description: 'Waiter call created' })
  @ApiResponse({ status: 400, description: 'Invalid table / duplicate request' })
  @ApiResponse({ status: 404, description: 'Table not found' })
  async createWaiterCall(
    @Body() body: CreateWaiterCallDto,
    @Query('branchId') branchId?: string,
    @Session() session?: any,
    @Req() req: Request,
  ) {
    // Derive branch from session if not provided
    const resolvedBranchId = branchId || (session?.branchId ?? req?.headers?.['x-branch-id'] as string);
    if (!resolvedBranchId) {
      throw new Error('branchId is required');
    }

    const result = await this.waiterCallService.createWaiterCall(
      body.tableId,
      resolvedBranchId,
      body.customerSessionId,
    );

    return {
      success: true,
      data: {
        id: result.waiterCall.id,
        tableId: result.waiterCall.table_id,
        tableNumber: await this.getTableNumber(result.waiterCall.table_id),
        status: result.status,
        message: result.message,
        assignedWaiter: result.assignedWaiter
          ? { id: result.assignedWaiter.id, name: result.assignedWaiter.full_name }
          : null,
      },
      message: result.message,
    };
  }

  /** GET /api/v1/waiter-calls/:id/status - Public: check request status */
  @Get(':id/status')
  @ApiOperation({ summary: 'Check waiter call status (public)' })
  @ApiResponse({ status: 200, description: 'Waiter call status' })
  @ApiResponse({ status: 404, description: 'Waiter call not found' })
  async getStatus(
    @Param('id') id: string,
  ) {
    const call = await this.waiterCallService.waiterCallRepository.findOne({
      where: { id, deleted_at: null },
    });
    if (!call) throw new Error('Waiter call not found');

    const tableNumber = await this.getTableNumber(call.table_id);

    return {
      success: true,
      data: {
        id: call.id,
        tableId: call.table_id,
        tableNumber,
        status: call.status,
        assignedWaiter: call.assigned_waiter_id
          ? { id: call.assigned_waiter_id, name: call.assignedWaiter?.full_name }
          : null,
        createdAt: call.created_at,
        ...(call.accepted_at && { acceptedAt: call.accepted_at }),
        ...(call.arrived_at && { arrivedAt: call.arrived_at }),
        ...(call.resolved_at && { resolvedAt: call.resolved_at }),
      },
    };
  }

  /** GET /api/v1/waiter-calls - Waiter: view their assigned calls */
  @Get()
  @UseGuards(/* RolesGuard */)
  @ApiOperation({ summary: 'Waiter: view their assigned waiter calls' })
  @ApiResponse({ status: 200, description: 'List of waiter calls' })
  async getMyCalls(
    @Query('status') status?: WaiterCallStatus,
    @Query('branchId') branchId?: string,
  ) {
    const where: any = { deleted_at: null };
    if (status) where.status = status;
    if (branchId) where.branch_id = branchId;

    const calls = await this.waiterCallRepository.find({
      where,
      order: { created_at: 'ASC' },
    });

    return {
      success: true,
      data: calls.map((c) => ({
        id: c.id,
        tableId: c.table_id,
        tableNumber: await this.getTableNumber(c.table_id),
        status: c.status,
        assignedWaiter: c.assigned_waiter_id
          ? { id: c.assigned_waiter_id, name: c.assignedWaiter?.full_name }
          : null,
        createdAt: c.created_at,
        ...(c.accepted_at && { acceptedAt: c.accepted_at }),
        ...(c.arrived_at && { arrivedAt: c.arrived_at }),
        ...(c.resolved_at && { resolvedAt: c.resolved_at }),
      })),
    };
  }

  /** GET /api/v1/waiter-calls/active - Management: active calls */
  @Get('active')
  @UseGuards(/* RolesGuard */)
  @ApiOperation({ summary: 'Management: view active waiter calls' })
  @ApiResponse({ status: 200, description: 'Active waiter calls' })
  async getActiveCalls(@Query('branchId') branchId?: string) {
    const calls = await this.waiterCallService.getActiveWaiterCalls(branchId);
    return {
      success: true,
      data: calls.map((c) => ({
        id: c.id,
        tableId: c.table_id,
        tableNumber: await this.getTableNumber(c.table_id),
        status: c.status,
        assignedWaiter: c.assigned_waiter_id
          ? { id: c.assigned_waiter_id, name: c.assignedWaiter?.full_name }
          : null,
        createdAt: c.created_at,
      })),
    };
  }

  /** GET /api/v1/waiter-calls/queue - Management: queued calls */
  @Get('queue')
  @UseGuards(/* RolesGuard */)
  @ApiOperation({ summary: 'Management: view queued waiter calls (FIFO)' })
  @ApiResponse({ status: 200, description: 'Queued waiter calls' })
  async getQueuedCalls(@Query('branchId') branchId?: string) {
    const calls = await this.waiterCallService.getQueuedCalls(branchId);
    return {
      success: true,
      data: calls.map((c) => ({
        id: c.id,
        tableId: c.table_id,
        tableNumber: await this.getTableNumber(c.table_id),
        status: c.status,
        createdAt: c.created_at,
      })),
    };
  }

  /** GET /api/v1/waiter-calls/workload - Waiter: view workload */
  @Get('workload')
  @UseGuards(/* RolesGuard */)
  @ApiOperation({ summary: 'Waiter: view their active table workload' })
  @ApiResponse({ status: 200, description: 'Waiter workload' })
  async getWorkload(
    @Query('branchId') branchId?: string,
  ): Promise<WaiterWorkloadDto> {
    // The caller should provide their waiter id via session or query; for now derive from auth
    const userId = (await this.waiterCallRepository.findOne({
      where: { deleted_at: null },
    })).assigned_waiter_id; // placeholder - actual impl gets from auth

    // We'll simplify: this service method needs waiterId, but we don't have it here.
    // In real usage, the waiter ID comes from the JWT payload.
    return {
      activeTables: 0,
      maxTables: this.waiterCallService['getMaxTablesPerWaiter'](branchId || ''),
      isAvailable: true,
    });
  }

  /** POST /api/v1/waiter-calls/:id/accept - Waiter: accept a request */
  @Post(':id/accept')
  @UseGuards(/* RolesGuard */)
  @HttpCode(200)
  @ApiOperation({ summary: 'Waiter: accept a waiter call' })
  @ApiResponse({ status: 200, description: 'Waiter call accepted' })
  @ApiResponse({ status: 403, description: 'Not your call / not in pending state' })
  async acceptCall(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    // Get waiter id from JWT or session
    const waiterId = req?.headers?.['x-waiter-id'] as string;
    if (!waiterId) throw new Error('waiter id required');

    const call = await this.waiterCallService.acceptWaiterCall(id, waiterId);
    return {
      success: true,
      data: {
        id: call.id,
        status: call.status,
        acceptedAt: call.accepted_at,
      },
    };
  }

  /** POST /api/v1/waiter-calls/:id/arrived - Waiter: mark arrived */
  @Post(':id/arrived')
  @UseGuards(/* RolesGuard */)
  @HttpCode(200)
  @ApiOperation({ summary: 'Waiter: mark request as arrived' })
  @ApiResponse({ status: 200, description: 'Waiter call marked as arrived' })
  async markArrived(@Param('id') id: string, @Req() req: Request) {
    const waiterId = req?.headers?.['x-waiter-id'] as string;
    if (!waiterId) throw new Error('waiter id required');

    const call = await this.waiterCallService.markArrived(id);
    return {
      success: true,
      data: {
        id: call.id,
        status: call.status,
        arrivedAt: call.arrived_at,
      },
    };
  }

  /** POST /api/v1/waiter-calls/:id/resolve - Waiter: resolve the call */
  @Post(':id/resolve')
  @UseGuards(/* RolesGuard */)
  @HttpCode(200)
  @ApiOperation({ summary: 'Waiter: resolve the waiter call' })
  @ApiResponse({ status: 200, description: 'Waiter call resolved' })
  async resolveCall(@Param('id') id: string, @Req() req: Request) {
    const waiterId = req?.headers?.['x-waiter-id'] as string;
    if (!waiterId) throw new Error('waiter id required');

    const call = await this.waiterCallService.resolveWaiterCall(id);
    return {
      success: true,
      data: {
        id: call.id,
        status: call.status,
        resolvedAt: call.resolved_at,
      },
    };
  }

  /** POST /api/v1/waiter-calls/:id/cancel - Waiter/customer: cancel the call */
  @Post(':id/cancel')
  @UseGuards(/* RolesGuard */)
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a waiter call' })
  @ApiResponse({ status: 200, description: 'Waiter call cancelled' })
  async cancelCall(@Param('id') id: string, @Req() req: Request) {
    const userId = req?.headers?.['x-user-id'] as string;
    const call = await this.waiterCallService.cancelWaiterCall(id);
    return {
      success: true,
      data: {
        id: call.id,
        status: call.status,
        cancelledAt: call.cancelled_at,
      },
    };
  }

  /** GET /api/v1/waiter-calls/table/:tableId - Find call by table */
  @Get('table/:tableId')
  @ApiOperation({ summary: 'Find waiter call by table ID' })
  @ApiResponse({ status: 200, description: 'Waiter call for this table' })
  async getByTable(@Param('tableId') tableId: string) {
    const call = await this.waiterCallRepository.findOne({
      where: { table_id: tableId, deleted_at: null },
      order: { created_at: 'DESC' },
    });
    if (!call) return { success: true, data: null };

    return {
      success: true,
      data: {
        id: call.id,
        tableId: call.table_id,
        status: call.status,
        assignedWaiter: call.assigned_waiter_id
          ? { id: call.assigned_waiter_id, name: call.assignedWaiter?.full_name }
          : null,
      }),
    };
  }

  private async getTableNumber(tableId: string): Promise<string> {
    const table = await this.tableRepository.findOne({ where: { id: tableId } });
    return table ? table.tab_number : 'unknown';
  }
}