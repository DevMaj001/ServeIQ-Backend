import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/shared';
import { WebhookEventsService } from './webhook-events.service';

/**
 * Super-admin observability over the payment webhook ledger: what each
 * provider delivered, what verified, what settled, and what needs attention.
 * Read-only — the ledger is append-only and never edited from the API.
 */
@ApiTags('Admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
@Controller('admin/webhook-events')
export class WebhookAdminController {
  constructor(private readonly webhookEvents: WebhookEventsService) {}

  @Get()
  @ApiOperation({
    summary: 'List inbound payment webhook deliveries (superadmin only)',
  })
  @ApiQuery({ name: 'provider', required: false })
  @ApiQuery({ name: 'branch_id', required: false })
  @ApiQuery({ name: 'outcome', required: false })
  @ApiQuery({ name: 'signature_status', required: false })
  @ApiQuery({ name: 'limit', required: false, example: '50' })
  @ApiQuery({
    name: 'before',
    required: false,
    description: 'ISO timestamp cursor: return events created before it',
  })
  @ApiResponse({ status: 200, description: 'Webhook delivery ledger rows.' })
  async list(
    @Query('provider') provider?: string,
    @Query('branch_id') branchId?: string,
    @Query('outcome') outcome?: string,
    @Query('signature_status') signatureStatus?: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const beforeDate = before ? new Date(before) : undefined;
    return this.webhookEvents.list({
      provider,
      branchId,
      outcome,
      signatureStatus,
      limit: limit ? Number(limit) : undefined,
      before:
        beforeDate && !Number.isNaN(beforeDate.getTime())
          ? beforeDate
          : undefined,
    });
  }

  @Get('health')
  @ApiOperation({
    summary:
      'Per-provider webhook health: last delivery, last verified, last settled, outcome counts (superadmin only)',
  })
  @ApiQuery({ name: 'window_hours', required: false, example: '24' })
  @ApiResponse({ status: 200, description: 'Provider health summary.' })
  async health(@Query('window_hours') windowHours?: string) {
    const hours = Number(windowHours);
    return this.webhookEvents.providerHealth(
      Number.isFinite(hours) && hours > 0 && hours <= 24 * 30 ? hours : 24,
    );
  }
}
