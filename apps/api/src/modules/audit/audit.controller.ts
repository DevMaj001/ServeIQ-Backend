import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  LessThanOrEqual,
  MoreThanOrEqual,
  Between,
  In,
} from 'typeorm';
import { AuditLog } from '../../entities/audit-log.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/shared';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('Audit Logs')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.OWNER,
  UserRole.MANAGER,
  UserRole.SUPERVISOR,
  UserRole.WAITER,
  UserRole.CHEF,
  UserRole.CASHIER,
)
@Controller('audit-logs')
export class AuditController {
  constructor(
    @InjectRepository(AuditLog)
    private auditRepo: Repository<AuditLog>,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get audit logs with filters and pagination (all staff roles)',
  })
  @ApiQuery({
    name: 'action',
    required: false,
    description: 'Filter by action type (e.g. order.approve)',
  })
  @ApiQuery({
    name: 'user_id',
    required: false,
    description: 'Filter by user UUID',
  })
  @ApiQuery({
    name: 'entity_type',
    required: false,
    description: 'Filter by entity type (e.g. order, User)',
  })
  @ApiQuery({
    name: 'entity_id',
    required: false,
    description: 'Filter by entity UUID',
  })
  @ApiQuery({
    name: 'date_from',
    required: false,
    description: 'Start date (ISO string)',
  })
  @ApiQuery({
    name: 'date_to',
    required: false,
    description: 'End date (ISO string)',
  })
  @ApiQuery({ name: 'page', required: false, example: '1' })
  @ApiQuery({ name: 'limit', required: false, example: '50' })
  @ApiResponse({ status: 200, description: 'Paginated audit log entries.' })
  async findAll(
    @Request() req: any,
    @Query('action') action?: string,
    @Query('user_id') userId?: string,
    @Query('entity_type') entityType?: string,
    @Query('entity_id') entityId?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const branchId = req.user.branchId;
    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(
      100,
      Math.max(1, parseInt(limit || '50', 10) || 50),
    );
    const skip = (pageNum - 1) * limitNum;

    const where: any = { branch_id: branchId };
    if (action) where.action = action;
    if (userId) where.user_id = userId;
    if (entityType) where.entity_type = entityType;
    if (entityId) where.entity_id = entityId;
    if (dateFrom || dateTo) {
      const from = dateFrom ? new Date(dateFrom) : new Date('2000-01-01');
      const to = dateTo ? new Date(dateTo) : new Date();
      where.created_at = Between(from, to);
    }

    const [data, total] = await this.auditRepo.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip,
      take: limitNum,
    });

    return {
      data,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  @Get('recent')
  @ApiOperation({
    summary: 'Get recent audit logs (last 20) — all staff roles',
  })
  @ApiResponse({ status: 200, description: 'Recent audit log entries.' })
  async findRecent(@Request() req: any) {
    return this.auditRepo.find({
      where: { branch_id: req.user.branchId },
      order: { created_at: 'DESC' },
      take: 20,
    });
  }
}
