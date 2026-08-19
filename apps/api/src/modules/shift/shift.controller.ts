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
import {
  CreateShiftTemplateDto,
  UpdateShiftTemplateDto,
} from './dto/shift-template.dto';

@ApiTags('Shifts')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class ShiftController {
  constructor(private readonly shiftService: ShiftService) {}

  @Get('shifts/templates')
  @ApiOperation({ summary: 'List all shift templates for the branch' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  async listTemplates(@Request() req: any) {
    return this.shiftService.listTemplates(req.user.branchId);
  }

  @Get('shifts/templates/:id')
  @ApiOperation({ summary: 'Get a single shift template' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  async getTemplate(@Request() req: any, @Param('id') id: string) {
    return this.shiftService.getTemplate(id, req.user.branchId);
  }

  @Post('shifts/templates')
  @ApiOperation({ summary: 'Create a new shift template' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  async createTemplate(
    @Request() req: any,
    @Body() dto: CreateShiftTemplateDto,
  ) {
    return this.shiftService.createTemplate(req.user.branchId, dto);
  }

  @Patch('shifts/templates/:id')
  @ApiOperation({ summary: 'Update a shift template' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  async updateTemplate(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateShiftTemplateDto,
  ) {
    return this.shiftService.updateTemplate(id, req.user.branchId, dto);
  }

  @Delete('shifts/templates/:id')
  @ApiOperation({ summary: 'Delete a shift template' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  async deleteTemplate(@Request() req: any, @Param('id') id: string) {
    return this.shiftService.deleteTemplate(id, req.user.branchId);
  }

  @Get('shifts')
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
  @ApiOperation({ summary: 'Get the currently open shift' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  async findCurrent(@Request() req: any): Promise<ShiftWithRelations | null> {
    return this.shiftService.findCurrent(req.user.branchId);
  }

  @Get('shifts/:id')
  @ApiOperation({ summary: 'Get a single shift' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  async findOne(@Request() req: any, @Param('id') id: string): Promise<ShiftWithRelations> {
    return this.shiftService.findOne(id, req.user.branchId);
  }

  @Get('shifts/:id/report')
  @ApiOperation({ summary: 'Get shift report with revenue breakdown' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  async getShiftReport(@Request() req: any, @Param('id') id: string): Promise<any> {
    return this.shiftService.getShiftReport(id, req.user.branchId);
  }

  @Post('shifts/open')
  @ApiOperation({ summary: 'Open a new shift with starting cash' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  async openShift(@Request() req: any, @Body() dto: OpenShiftDto): Promise<ShiftWithRelations> {
    return this.shiftService.openShift(req.user.branchId, req.user.userId, dto);
  }

  @Post('shifts/:id/close')
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

  @Get('reports/shifts')
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