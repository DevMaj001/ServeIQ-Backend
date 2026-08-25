import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { TabService } from './tab.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../role/permission-codes';
import { UserRole } from '../../common/shared';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { OpenTabDto } from './dto/open-tab.dto';
import { MergeTabDto } from './dto/merge-tab.dto';
import { TransferTabDto } from './dto/transfer-tab.dto';
import { UpdateTabDto } from './dto/update-tab.dto';
import { VoidTabDto } from './dto/void-tab.dto';
import { Tab } from './entities/tab.entity';
import { getPaginationParams, paginate } from '../../common/pagination';

@ApiTags('Tabs')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('tabs')
export class TabController {
  constructor(private readonly tabService: TabService) {}

  @Get()
  @ApiOperation({
    summary:
      'Get all tabs for the branch (optionally filtered by status or waiter)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['open', 'billed', 'paid', 'voided'],
    description:
      'Filter by tab status. Multiple statuses can be comma-separated, e.g. "open,billed".',
  })
  @ApiQuery({
    name: 'waiter_id',
    required: false,
    description: 'Filter by waiter UUID',
  })
  @ApiQuery({ name: 'page', required: false, example: '1' })
  @ApiQuery({
    name: 'per_page',
    required: false,
    example: '20',
    description: 'Defaults to 20, max 100',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of tabs with waiter/table/orders.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findAll(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('waiter_id') waiterId?: string,
    @Query('page') page?: string,
    @Query('per_page') per_page?: string,
  ) {
    const pagination = getPaginationParams({ page, per_page });
    // Waiters may only ever see their own tabs — ignore any client-supplied
    // waiter_id filter. Managers/supervisors/owners keep full branch visibility.
    const effectiveWaiterId =
      req.user.role === UserRole.WAITER ? req.user.userId : waiterId;
    const { data, total } = await this.tabService.findAllByBranch(
      req.user.branchId,
      status,
      effectiveWaiterId,
      pagination,
    );
    return paginate(data, total, pagination);
  }

  @Get('waiter-list')
  @ApiOperation({
    summary:
      'List all users who have tabs in this branch (for filter dropdown)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of users with waiter name and id.',
    schema: {
      example: [
        { id: 'uuid-1', full_name: 'Stella Celetine', role: 'waiter' },
        { id: 'uuid-2', full_name: 'Admin User', role: 'owner' },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getTabWaiters(@Request() req: any) {
    return this.tabService.getTabWaiters(req.user.branchId);
  }

  @Post('open')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.WAITER,
    UserRole.SUPERVISOR,
    UserRole.MANAGER,
    UserRole.OWNER,
  )
  @ApiOperation({ summary: 'Open a new tab at a table' })
  @ApiResponse({
    status: 201,
    description: 'Tab opened successfully.',
    type: Tab,
  })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async openTab(@Request() req: any, @Body() createDto: OpenTabDto) {
    return this.tabService.openTab(
      {
        ...createDto,
        branch_id: req.user.branchId,
        waiter_id: req.user.userId,
      },
      req.user.userId,
      req.user.role,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a tab by ID (includes its orders)' })
  @ApiParam({ name: 'id', description: 'Tab UUID', example: 'tab-uuid-here' })
  @ApiResponse({
    status: 200,
    description: 'Tab record with order items.',
    type: Tab,
  })
  @ApiResponse({ status: 404, description: 'Tab not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.tabService.findOne(
      id,
      req.user.branchId,
      req.user.userId,
      req.user.role,
    );
  }

  @Post(':id/close')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.WAITER,
    UserRole.SUPERVISOR,
    UserRole.MANAGER,
    UserRole.OWNER,
    UserRole.CASHIER,
  )
  @ApiOperation({ summary: 'Close an open tab (triggers billing)' })
  @ApiParam({ name: 'id', description: 'Tab UUID', example: 'tab-uuid-here' })
  @ApiResponse({ status: 200, description: 'Tab closed and bill generated.' })
  @ApiResponse({ status: 404, description: 'Tab not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async closeTab(@Param('id') id: string, @Request() req: any) {
    return this.tabService.closeTab(
      id,
      req.user.branchId,
      req.user.userId,
      req.user.role,
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERVISOR, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update a tab (Supervisor/Manager/Owner only)' })
  @ApiParam({ name: 'id', description: 'Tab UUID' })
  @ApiResponse({ status: 200, description: 'Tab updated.' })
  @ApiResponse({ status: 404, description: 'Tab not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() updateDto: UpdateTabDto,
  ) {
    return this.tabService.update(id, req.user.branchId, updateDto);
  }

  @Post(':id/transfer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERVISOR, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Transfer a tab to a different table (Supervisor/Manager/Owner)',
  })
  @ApiParam({ name: 'id', description: 'Tab UUID' })
  @ApiResponse({ status: 200, description: 'Tab transferred to new table.' })
  @ApiResponse({ status: 400, description: 'Target table not available.' })
  @ApiResponse({ status: 404, description: 'Tab or table not found.' })
  async transferTab(
    @Param('id') id: string,
    @Request() req: any,
    @Body() transferDto: TransferTabDto,
  ) {
    return this.tabService.transferTab(
      id,
      req.user.branchId,
      transferDto.target_table_id,
    );
  }

  @Post(':id/merge')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.SUPERVISOR, UserRole.OWNER, UserRole.MANAGER)
  @RequirePermissions(PERMISSIONS.MERGE_TABLES)
  @ApiOperation({
    summary:
      'Merge an open tab into another open tab (orders move onto the target)',
  })
  @ApiParam({ name: 'id', description: 'Source tab UUID' })
  @ApiResponse({ status: 200, description: 'Tab merged into target tab.' })
  @ApiResponse({ status: 400, description: 'Merge validation error.' })
  @ApiResponse({ status: 404, description: 'Tab not found.' })
  async mergeTab(
    @Param('id') id: string,
    @Request() req: any,
    @Body() mergeDto: MergeTabDto,
  ) {
    return this.tabService.mergeTab(
      id,
      req.user.branchId,
      mergeDto.target_tab_id,
      req.user.userId,
      req.user.role,
    );
  }

  @Post(':id/void')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERVISOR, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Void a tab with a reason (Supervisor/Manager/Owner)',
  })
  @ApiParam({ name: 'id', description: 'Tab UUID' })
  @ApiResponse({ status: 200, description: 'Tab voided.' })
  @ApiResponse({ status: 400, description: 'Tab is not open.' })
  @ApiResponse({ status: 404, description: 'Tab not found.' })
  async voidTab(
    @Param('id') id: string,
    @Request() req: any,
    @Body() voidDto: VoidTabDto,
  ) {
    return this.tabService.voidTab(
      id,
      req.user.branchId,
      req.user.userId,
      req.user.role,
      voidDto.reason,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @RequirePermissions(PERMISSIONS.CLOSE_TABLE)
  @ApiOperation({ summary: 'Delete a tab (Owner/Manager only)' })
  @ApiParam({ name: 'id', description: 'Tab UUID' })
  @ApiResponse({ status: 200, description: 'Tab deleted.' })
  @ApiResponse({ status: 404, description: 'Tab not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.tabService.remove(id, req.user.branchId);
  }
}
