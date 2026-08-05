import { Controller, Get, Post, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { ShiftService } from './shift.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { OpenShiftDto } from './dto/open-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';

@ApiTags('Shifts')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class ShiftController {
  constructor(private readonly shiftService: ShiftService) {}

  @Get('shifts')
  @ApiOperation({ summary: 'List all shifts for the branch' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  async findAll(@Request() req: any) {
    return this.shiftService.findAll(req.user.branchId);
  }

  @Get('shifts/current')
  @ApiOperation({ summary: 'Get the currently open shift' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  async findCurrent(@Request() req: any) {
    return this.shiftService.findCurrent(req.user.branchId);
  }

  @Post('shifts/open')
  @ApiOperation({ summary: 'Open a new shift with starting cash' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  async openShift(@Request() req: any, @Body() dto: OpenShiftDto) {
    return this.shiftService.openShift(req.user.branchId, req.user.userId, dto);
  }

  @Post('shifts/:id/close')
  @ApiOperation({ summary: 'Close a shift with actual cash counted' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  async closeShift(@Param('id') id: string, @Request() req: any, @Body() dto: CloseShiftDto) {
    return this.shiftService.closeShift(id, req.user.branchId, req.user.userId, dto);
  }

  @Get('reports/shifts')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Shift report with date range and reconciliation summary' })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  async getShiftSummary(
    @Request() req: any,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.shiftService.getShiftSummary(req.user.branchId, dateFrom, dateTo);
  }
}
