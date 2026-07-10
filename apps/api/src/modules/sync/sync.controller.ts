import { Controller, Post, Get, Body, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Sync')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('queue')
  @ApiOperation({ summary: 'Queue an offline operation for sync' })
  async queueOperation(@Request() req: any, @Body() body: { entity_type: string; operation: string; payload: any; client_idempotency_key?: string }) {
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
  async replayAll(@Request() req: any) {
    return this.syncService.replayAll(req.user.branchId);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get sync queue status counts' })
  async getStatus(@Request() req: any) {
    return this.syncService.getSyncStatus(req.user.branchId);
  }

  @Get('full')
  @ApiOperation({ summary: 'Get full snapshot for offline bootstrap' })
  async getFullSync(@Request() req: any) {
    return this.syncService.getFullSyncData(req.user.branchId);
  }
}