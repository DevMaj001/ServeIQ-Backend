import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { TabService } from './tab.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { OpenTabDto } from './dto/open-tab.dto';
import { TransferTabDto } from './dto/transfer-tab.dto';
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
  @ApiOperation({ summary: 'Get all tabs for the branch (optionally filtered by status)' })
  @ApiQuery({ name: 'status', required: false, enum: ['open', 'billed', 'paid', 'voided'] })
  @ApiQuery({ name: 'page', required: false, example: '1' })
  @ApiQuery({ name: 'per_page', required: false, example: '20' })
  @ApiResponse({ status: 200, description: 'List of tabs with details.', type: [Tab] })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findAll(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('per_page') per_page?: string,
  ) {
    const pagination = getPaginationParams({ page, per_page });
    const { data, total } = await this.tabService.findAllByBranch(req.user.branchId, status, pagination);
    return paginate(data, total, pagination);
  }

  @Post('open')
  @ApiOperation({ summary: 'Open a new tab at a table' })
  @ApiResponse({ status: 201, description: 'Tab opened successfully.', type: Tab })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async openTab(@Request() req: any, @Body() createDto: OpenTabDto) {
    return this.tabService.openTab({
      ...createDto,
      branch_id: req.user.branchId,
      waiter_id: req.user.userId,
    }, req.user.userId, req.user.role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a tab by ID (includes its orders)' })
  @ApiParam({ name: 'id', description: 'Tab UUID', example: 'tab-uuid-here' })
  @ApiResponse({ status: 200, description: 'Tab record with order items.', type: Tab })
  @ApiResponse({ status: 404, description: 'Tab not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.tabService.findOne(id, req.user.branchId, req.user.userId, req.user.role);
  }

  @Post(':id/close')
  @ApiOperation({ summary: 'Close an open tab (triggers billing)' })
  @ApiParam({ name: 'id', description: 'Tab UUID', example: 'tab-uuid-here' })
  @ApiResponse({ status: 200, description: 'Tab closed and bill generated.' })
  @ApiResponse({ status: 404, description: 'Tab not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async closeTab(@Param('id') id: string, @Request() req: any) {
    return this.tabService.closeTab(id, req.user.branchId, req.user.userId, req.user.role);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a tab' })
  @ApiParam({ name: 'id', description: 'Tab UUID' })
  @ApiResponse({ status: 200, description: 'Tab updated.' })
  @ApiResponse({ status: 404, description: 'Tab not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async update(@Param('id') id: string, @Request() req: any, @Body() updateDto: any) {
    return this.tabService.update(id, req.user.branchId, updateDto);
  }

  @Post(':id/transfer')
  @ApiOperation({ summary: 'Transfer a tab to a different table' })
  @ApiParam({ name: 'id', description: 'Tab UUID' })
  @ApiResponse({ status: 200, description: 'Tab transferred to new table.' })
  @ApiResponse({ status: 400, description: 'Target table not available.' })
  @ApiResponse({ status: 404, description: 'Tab or table not found.' })
  async transferTab(
    @Param('id') id: string,
    @Request() req: any,
    @Body() transferDto: TransferTabDto,
  ) {
    return this.tabService.transferTab(id, req.user.branchId, transferDto.target_table_id);
  }

  @Post(':id/void')
  @ApiOperation({ summary: 'Void a tab with a reason (manager only)' })
  @ApiParam({ name: 'id', description: 'Tab UUID' })
  @ApiResponse({ status: 200, description: 'Tab voided.' })
  @ApiResponse({ status: 400, description: 'Tab is not open.' })
  @ApiResponse({ status: 404, description: 'Tab not found.' })
  async voidTab(
    @Param('id') id: string,
    @Request() req: any,
    @Body() voidDto: VoidTabDto,
  ) {
    return this.tabService.voidTab(id, req.user.branchId, req.user.userId, req.user.role, voidDto.reason);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a tab' })
  @ApiParam({ name: 'id', description: 'Tab UUID' })
  @ApiResponse({ status: 200, description: 'Tab deleted.' })
  @ApiResponse({ status: 404, description: 'Tab not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.tabService.remove(id, req.user.branchId);
  }
}


