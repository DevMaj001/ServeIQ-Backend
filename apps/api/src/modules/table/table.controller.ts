import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { TableService } from './table.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/shared';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { UpdateTableStatusDto } from './dto/update-table-status.dto';
import { Table } from './entities/table.entity';
import { getPaginationParams, paginate } from '../../common/pagination';

@ApiTags('Tables')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('tables')
export class TableController {
  constructor(private readonly tableService: TableService) {}

  @Get()
  @ApiOperation({ summary: 'Get all tables for the branch' })
  @ApiQuery({ name: 'page', required: false, example: '1' })
  @ApiQuery({ name: 'per_page', required: false, example: '50' })
  @ApiResponse({
    status: 200,
    description: 'List of tables with statuses.',
    type: [Table],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findAll(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('per_page') per_page?: string,
  ) {
    const pagination = getPaginationParams({ page, per_page });
    const { data, total } = await this.tableService.findAllByBranch(
      req.user.branchId,
      pagination,
    );
    return paginate(data, total, pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a table by ID' })
  @ApiParam({ name: 'id', description: 'Table UUID' })
  @ApiResponse({ status: 200, description: 'Table details.', type: Table })
  @ApiResponse({ status: 404, description: 'Table not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.tableService.findOne(id, req.user.branchId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a new table (Owner/Manager only)' })
  @ApiResponse({ status: 201, description: 'Table created.', type: Table })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async create(@Request() req: any, @Body() createDto: CreateTableDto) {
    const data = { ...createDto };

    // Defensive mapping for Waiter app or other clients that might send different field names
    if (!data.table_number) {
      data.table_number =
        data.table_number || `T-${Math.floor(Math.random() * 1000)}`;
    }

    return this.tableService.create({
      ...data,
      branch_id: req.user.branchId,
    });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update a table (Owner/Manager only)' })
  @ApiParam({ name: 'id', description: 'Table UUID' })
  @ApiResponse({ status: 200, description: 'Table updated.' })
  @ApiResponse({ status: 404, description: 'Table not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() updateDto: UpdateTableDto,
  ) {
    return this.tableService.update(id, req.user.branchId, updateDto);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update table status (available/occupied/reserved)',
  })
  @ApiParam({ name: 'id', description: 'Table UUID' })
  @ApiResponse({ status: 200, description: 'Table status updated.' })
  @ApiResponse({ status: 404, description: 'Table not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async updateStatus(
    @Param('id') id: string,
    @Request() req: any,
    @Body() statusDto: UpdateTableStatusDto,
  ) {
    return this.tableService.updateStatus(
      id,
      req.user.branchId,
      statusDto.status,
    );
  }

  @Post(':id/release')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Force-release a table and void its open tab (owner/manager only)',
  })
  @ApiParam({ name: 'id', description: 'Table UUID' })
  @ApiResponse({ status: 200, description: 'Table released.' })
  @ApiResponse({
    status: 403,
    description: 'Only owners and managers can release a table.',
  })
  @ApiResponse({ status: 404, description: 'Table not found.' })
  async releaseTable(@Param('id') id: string, @Request() req: any) {
    return this.tableService.release(
      id,
      req.user.branchId,
      req.user.userId,
      req.user.role,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete a table (Owner/Manager only)' })
  @ApiParam({ name: 'id', description: 'Table UUID' })
  @ApiResponse({ status: 200, description: 'Table deleted.' })
  @ApiResponse({ status: 404, description: 'Table not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.tableService.remove(id, req.user.branchId);
  }
}
