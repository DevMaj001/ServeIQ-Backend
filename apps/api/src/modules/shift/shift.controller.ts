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
import { ShiftService, ShiftWithRelations } from './shift.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { UserRole } from '../../common/shared';
import { PERMISSIONS } from '../role/permission-codes';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { OpenShiftDto } from './dto/open-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';
import { HandoffShiftDto } from './dto/handoff-shift.dto';
import {
  CreateShiftTemplateDto,
  UpdateShiftTemplateDto,
} from './dto/shift-template.dto';

@ApiTags('Shifts')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ShiftController {
  constructor(private readonly shiftService: ShiftService) {}

  @Get('shifts/templates')
  @Roles(
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.SUPERVISOR,
    UserRole.WAITER,
    UserRole.CHEF,
    UserRole.CASHIER,
  )
  @ApiOperation({ summary: 'List all shift templates for the business' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  async listTemplates(@Request() req: any) {
    return this.shiftService.listTemplates(req.user.businessId);
  }

  @Get('shifts/templates/:id')
  @Roles(
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.SUPERVISOR,
    UserRole.WAITER,
    UserRole.CHEF,
    UserRole.CASHIER,
  )
  @ApiOperation({ summary: 'Get a single shift template' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  async getTemplate(@Request() req: any, @Param('id') id: string) {
    return this.shiftService.getTemplate(id, req.user.businessId);
  }

  @Post('shifts/templates')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @RequirePermissions(PERMISSIONS.MANAGE_SHIFTS)
  @ApiOperation({ summary: 'Create a new shift template' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  async createTemplate(
    @Request() req: any,
    @Body() dto: CreateShiftTemplateDto,
  ) {
    return this.shiftService.createTemplate(
      req.user.businessId,
      req.user.branchId,
      dto,
    );
  }

  @Patch('shifts/templates/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @RequirePermissions(PERMISSIONS.MANAGE_SHIFTS)
  @ApiOperation({ summary: 'Update a shift template' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  async updateTemplate(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateShiftTemplateDto,
  ) {
    return this.shiftService.updateTemplate(id, req.user.businessId, dto);
  }

  @Delete('shifts/templates/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @RequirePermissions(PERMISSIONS.MANAGE_SHIFTS)
  @ApiOperation({ summary: 'Delete a shift template' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  async deleteTemplate(@Request() req: any, @Param('id') id: string) {
    return this.shiftService.deleteTemplate(id, req.user.businessId);
  }

  @Get('shifts')
  @Roles(
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.SUPERVISOR,
    UserRole.WAITER,
    UserRole.CHEF,
    UserRole.CASHIER,
  )
  @ApiOperation({ summary: 'List all shifts for the branch' })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  async findAll(
    @Request() req: any,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('status') status?: string,
  ): Promise<ShiftWithRelations[]> {
    return this.shiftService.findAll(
      req.user.branchId,
      dateFrom,
      dateTo,
      status,
    );
  }

  @Get('shifts/current')
  @Roles(
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.SUPERVISOR,
    UserRole.WAITER,
    UserRole.CHEF,
    UserRole.CASHIER,
  )
  @ApiOperation({ summary: 'Get the currently open shift' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  async findCurrent(@Request() req: any): Promise<ShiftWithRelations | null> {
    return this.shiftService.findCurrent(req.user.branchId);
  }

  @Get('shifts/:id')
  @Roles(
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.SUPERVISOR,
    UserRole.WAITER,
    UserRole.CHEF,
    UserRole.CASHIER,
  )
  @ApiOperation({ summary: 'Get a single shift' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  async findOne(@Request() req: any, @Param('id') id: string): Promise<ShiftWithRelations> {
    return this.shiftService.findOne(id, req.user.branchId);
  }

  @Get('shifts/:id/report')
  @Roles(
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.SUPERVISOR,
    UserRole.WAITER,
    UserRole.CHEF,
    UserRole.CASHIER,
  )
  @ApiOperation({ summary: 'Get shift report with revenue breakdown' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  async getShiftReport(@Request() req: any, @Param('id') id: string): Promise<any> {
    return this.shiftService.getShiftReport(id, req.user.branchId);
  }

  @Post('shifts/open')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @RequirePermissions(PERMISSIONS.MANAGE_SHIFTS)
  @ApiOperation({ summary: 'Open a new shift with starting cash' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  async openShift(@Request() req: any, @Body() dto: OpenShiftDto): Promise<ShiftWithRelations> {
    return this.shiftService.openShift(
      req.user.branchId,
      req.user.businessId,
      req.user.userId,
      dto,
    );
  }

  @Post('shifts/:id/close')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @RequirePermissions(PERMISSIONS.MANAGE_SHIFTS)
  @ApiOperation({ summary: 'Close a shift with actual cash counted' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  async closeShift(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: CloseShiftDto,
  ) {
    return this.shiftService.closeShift(
      id,
      req.user.branchId,
      req.user.userId,
      dto,
    );
  }

  @Post('shifts/handoff')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERVISOR)
  @RequirePermissions(PERMISSIONS.MANAGE_SHIFTS)
  @ApiOperation({
    summary: 'Hand off open tabs to another staff member',
    description:
      'Transfers all open tabs from the current open shift to a target staff member. Optionally restrict to tabs assigned to a specific staff member.',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 404 })
  async handoffShift(
    @Request() req: any,
    @Body() dto: HandoffShiftDto,
  ) {
    return this.shiftService.handoffShift(req.user.branchId, dto);
  }

  @Get('reports/shifts')
  @Roles(
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.SUPERVISOR,
    UserRole.WAITER,
    UserRole.CHEF,
    UserRole.CASHIER,
  )
  @ApiOperation({
    summary: 'Shift report with date range and reconciliation summary',
  })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  async getShiftSummary(
    @Request() req: any,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.shiftService.getShiftSummary(
      req.user.branchId,
      dateFrom,
      dateTo,
    );
  }
}