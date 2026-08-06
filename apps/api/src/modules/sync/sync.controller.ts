import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { SyncService, SyncPayload } from './sync.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface RequestWithUser {
  user: {
    branchId: string;
  };
}
@ApiTags('Sync')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('queue')
  @ApiOperation({ summary: 'Queue an offline operation for sync' })
  @ApiResponse({ status: 200 })
  async queueOperation(
    @Request() req: RequestWithUser,
    @Body()
    body: {
      entity_type: string;
      operation: string;
      payload: SyncPayload;
      client_idempotency_key?: string;
    },
  ) {
    return this.syncService.queueOperation(
      req.user.branchId,
      body.entity_type,
      body.operation,
      body.payload,
      body.client_idempotency_key,
    );
  }

  @Post('replay')
  @ApiOperation({ summary: 'Replay all pending queued operations' })
  @ApiResponse({ status: 200 })
  async replayAll(@Request() req: RequestWithUser) {
    return this.syncService.replayAll(req.user.branchId);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get sync queue status counts' })
  @ApiResponse({ status: 200 })
  async getStatus(@Request() req: RequestWithUser) {
    return this.syncService.getSyncStatus(req.user.branchId);
  }

  @Get('full')
  @ApiOperation({ summary: 'Get full snapshot for offline bootstrap' })
  @ApiResponse({ status: 200 })
  async getFullSync(@Request() req: RequestWithUser) {
    return this.syncService.getFullSyncData(req.user.branchId);
  }
}
