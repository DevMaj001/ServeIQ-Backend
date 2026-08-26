import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/shared';
import { WaiterCallService } from './waiter-call.service';
import { CreateWaiterCallDto } from './dto/waiter-call.dto';
import { WaiterCallStatus } from './entities/waiter-call.entity';
import { WaiterCall } from './entities/waiter-call.entity';

interface AuthedUser {
  userId: string;
  branchId: string;
  role: UserRole;
}

@ApiTags('Waiter Call')
@Controller('api/v1/waiter-calls')
export class WaiterCallController {
  constructor(private readonly waiterCallService: WaiterCallService) {}

  /** PUBLIC: Customer calls a waiter (no auth). */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(201)
  @ApiOperation({ summary: 'Customer calls a waiter (public, no auth)' })
  @ApiResponse({ status: 201, description: 'Waiter call created' })
  async createWaiterCall(@Body() body: CreateWaiterCallDto, @Req() req: Request) {
    const branchId =
      (req.query['branchId'] as string) || (req.headers['x-branch-id'] as string);
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

  /** PUBLIC: Check waiter call status. */
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

  /** PUBLIC: Find waiter call by table ID. */
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

  /** WAITER: view their assigned waiter calls. */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.WAITER)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Waiter: view their assigned waiter calls' })
  async getMyCalls(@Req() req: Request, @Query('status') status?: WaiterCallStatus) {
    const user = req.user as AuthedUser;
    const calls = await this.waiterCallService.getMyCalls(user.userId, status, user.branchId);
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

  /** WAITER: view their active table workload. */
  @Get('workload/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.WAITER)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Waiter: view their active table workload' })
  async getWorkload(@Req() req: Request) {
    const user = req.user as AuthedUser;
    const workload = await this.waiterCallService.getWaiterWorkload(user.userId, user.branchId);
    return { success: true, data: workload };
  }

  /** WAITER: accept a waiter call. */
  @Post(':id/accept')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.WAITER)
  @ApiBearerAuth('access-token')
  @HttpCode(200)
  @ApiOperation({ summary: 'Waiter: accept a waiter call' })
  async acceptCall(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as AuthedUser;
    const call = await this.waiterCallService.acceptWaiterCall(id, user.userId);
    return {
      success: true,
      data: { id: call.id, status: call.status, acceptedAt: call.accepted_at },
    };
  }

  /** WAITER: mark request as arrived. */
  @Post(':id/arrived')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.WAITER)
  @ApiBearerAuth('access-token')
  @HttpCode(200)
  @ApiOperation({ summary: 'Waiter: mark request as arrived' })
  async markArrived(@Param('id') id: string, @Req() req: Request) {
    const arrived = await this.waiterCallService.markArrived(id);
    return {
      success: true,
      data: { id: arrived.id, status: arrived.status, arrivedAt: arrived.arrived_at },
    };
  }

  /** WAITER/MANAGER: resolve the waiter call. */
  @Post(':id/resolve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.WAITER, UserRole.MANAGER, UserRole.OWNER, UserRole.SUPERVISOR)
  @ApiBearerAuth('access-token')
  @HttpCode(200)
  @ApiOperation({ summary: 'Waiter/Manager: resolve the waiter call' })
  async resolveCall(@Param('id') id: string, @Req() req: Request) {
    const call = await this.waiterCallService.resolveWaiterCall(id);
    return {
      success: true,
      data: { id: call.id, status: call.status, resolvedAt: call.resolved_at },
    };
  }

  /** WAITER/MANAGER: cancel a waiter call. */
  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.WAITER, UserRole.MANAGER, UserRole.OWNER, UserRole.SUPERVISOR)
  @ApiBearerAuth('access-token')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a waiter call' })
  async cancelCall(@Param('id') id: string, @Req() req: Request) {
    const call = await this.waiterCallService.cancelWaiterCall(id);
    return {
      success: true,
      data: { id: call.id, status: call.status, cancelledAt: call.cancelled_at },
    };
  }

  /** MANAGEMENT: view active waiter calls. */
  @Get('active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.SUPERVISOR)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Management: view active waiter calls' })
  async getActiveCalls(@Req() req: Request) {
    const user = req.user as AuthedUser;
    const calls = await this.waiterCallService.getActiveWaiterCalls(user.branchId);
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

  /** MANAGEMENT: view queued waiter calls (FIFO). */
  @Get('queue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.SUPERVISOR)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Management: view queued waiter calls (FIFO)' })
  async getQueuedCalls(@Req() req: Request) {
    const user = req.user as AuthedUser;
    const calls = await this.waiterCallService.getQueuedCalls(user.branchId);
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
}
