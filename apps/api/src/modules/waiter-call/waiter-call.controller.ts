import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { WaiterCallService } from './waiter-call.service';
import { CreateWaiterCallDto } from './dto/waiter-call.dto';
import { WaiterCallStatus } from './entities/waiter-call.entity';
import { WaiterCall } from './entities/waiter-call.entity';

@ApiTags('Waiter Call')
@Controller('api/v1/waiter-calls')
@Throttle({ default: { limit: 10, ttl: 60000 } })
export class WaiterCallController {
  constructor(private readonly waiterCallService: WaiterCallService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Customer calls a waiter (public, no auth)' })
  @ApiResponse({ status: 201, description: 'Waiter call created' })
  async createWaiterCall(@Body() body: CreateWaiterCallDto, @Req() req: Request) {
    const branchId =
      (req.query['branchId'] as string) ||
      (req.headers['x-branch-id'] as string);
    if (!branchId) {
      throw new Error('branchId is required');
    }

    const result = await this.waiterCallService.createWaiterCall(
      body.tableId,
      branchId,
      body.customerSessionId,
    );

    return {
      success: true,
      data: {
        id: result.waiterCall.id,
        tableId: result.waiterCall.table_id,
        status: result.status,
        message: result.message,
        assignedWaiter: result.assignedWaiter
          ? { id: result.assignedWaiter.id, name: result.assignedWaiter.full_name }
          : null,
      },
      message: result.message,
    };
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Check waiter call status (public)' })
  @ApiResponse({ status: 200, description: 'Waiter call status' })
  async getStatus(@Param('id') id: string) {
    const call = await this.waiterCallService.getCallById(id);
    if (!call) throw new Error('Waiter call not found');

    return {
      success: true,
      data: {
        id: call.id,
        tableId: call.table_id,
        status: call.status,
        assignedWaiter: call.assigned_waiter_id
          ? { id: call.assigned_waiter_id }
          : null,
        createdAt: call.created_at,
        acceptedAt: call.accepted_at,
        arrivedAt: call.arrived_at,
        resolvedAt: call.resolved_at,
      },
    };
  }

  @Get()
  @ApiOperation({ summary: 'Waiter: view their assigned waiter calls' })
  async getMyCalls(
    @Req() req: Request,
    @Query('status') status?: WaiterCallStatus,
    @Query('branchId') branchId?: string,
  ) {
    const waiterId = req.headers['x-waiter-id'] as string;
    if (!waiterId) throw new Error('waiter id required');

    const calls = await this.waiterCallService.getMyCalls(waiterId, status, branchId);
    return {
      success: true,
      data: calls.map((c) => ({
        id: c.id,
        tableId: c.table_id,
        status: c.status,
        assignedWaiter: c.assigned_waiter_id ? { id: c.assigned_waiter_id } : null,
        createdAt: c.created_at,
        acceptedAt: c.accepted_at,
        arrivedAt: c.arrived_at,
        resolvedAt: c.resolved_at,
      })),
    };
  }

  @Get('active')
  @ApiOperation({ summary: 'Management: view active waiter calls' })
  async getActiveCalls(@Query('branchId') branchId?: string) {
    const calls = await this.waiterCallService.getActiveWaiterCalls(branchId);
    return {
      success: true,
      data: calls.map((c) => ({
        id: c.id,
        tableId: c.table_id,
        status: c.status,
        assignedWaiter: c.assigned_waiter_id ? { id: c.assigned_waiter_id } : null,
        createdAt: c.created_at,
      })),
    };
  }

  @Get('queue')
  @ApiOperation({ summary: 'Management: view queued waiter calls (FIFO)' })
  async getQueuedCalls(@Query('branchId') branchId?: string) {
    const calls = await this.waiterCallService.getQueuedCalls(branchId);
    return {
      success: true,
      data: calls.map((c) => ({
        id: c.id,
        tableId: c.table_id,
        status: c.status,
        createdAt: c.created_at,
      })),
    };
  }

  @Get('table/:tableId')
  @ApiOperation({ summary: 'Find waiter call by table ID' })
  async getByTable(@Param('tableId') tableId: string) {
    const call = await this.waiterCallService.getCallsByTable(tableId);
    if (!call) return { success: true, data: null };
    return {
      success: true,
      data: {
        id: call.id,
        tableId: call.table_id,
        status: call.status,
        assignedWaiter: call.assigned_waiter_id ? { id: call.assigned_waiter_id } : null,
      },
    };
  }

  @Post(':id/accept')
  @HttpCode(200)
  @ApiOperation({ summary: 'Waiter: accept a waiter call' })
  async acceptCall(@Param('id') id: string, @Req() req: Request) {
    const waiterId = req.headers['x-waiter-id'] as string;
    if (!waiterId) throw new Error('waiter id required');
    const call = await this.waiterCallService.acceptWaiterCall(id, waiterId);
    return {
      success: true,
      data: { id: call.id, status: call.status, acceptedAt: call.accepted_at },
    };
  }

  @Post(':id/arrived')
  @HttpCode(200)
  @ApiOperation({ summary: 'Waiter: mark request as arrived' })
  async markArrived(@Param('id') id: string, @Req() req: Request) {
    const waiterId = req.headers['x-waiter-id'] as string;
    if (!waiterId) throw new Error('waiter id required');
    const call = await this.waiterCallService.markArrived(id);
    return {
      success: true,
      data: { id: call.id, status: call.status, arrivedAt: call.arrived_at },
    };
  }

  @Post(':id/resolve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Waiter: resolve the waiter call' })
  async resolveCall(@Param('id') id: string, @Req() req: Request) {
    const waiterId = req.headers['x-waiter-id'] as string;
    if (!waiterId) throw new Error('waiter id required');
    const call = await this.waiterCallService.resolveWaiterCall(id);
    return {
      success: true,
      data: { id: call.id, status: call.status, resolvedAt: call.resolved_at },
    };
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a waiter call' })
  async cancelCall(@Param('id') id: string, @Req() req: Request) {
    const call = await this.waiterCallService.cancelWaiterCall(id);
    return {
      success: true,
      data: { id: call.id, status: call.status, cancelledAt: call.cancelled_at },
    };
  }

  @Get('workload/me')
  @ApiOperation({ summary: 'Waiter: view their active table workload' })
  async getWorkload(@Req() req: Request, @Query('branchId') branchId?: string) {
    const waiterId = req.headers['x-waiter-id'] as string;
    if (!waiterId) throw new Error('waiter id required');
    const workload = await this.waiterCallService.getWaiterWorkload(waiterId, branchId);
    return { success: true, data: workload };
  }
}
