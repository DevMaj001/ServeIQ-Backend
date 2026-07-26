import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, Query, Sse, MessageEvent } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Observable, map } from 'rxjs';
import { PrinterService } from './printer.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/shared';
import { CreatePrinterDto } from './dto/create-printer.dto';
import { UpdatePrinterDto } from './dto/update-printer.dto';

@ApiTags('Printers & KDS')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class PrinterController {
  constructor(private readonly printerService: PrinterService) {}

  @Get('printers')
  @ApiOperation({ summary: 'List all printers for this branch' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Request() req: any) {
    return this.printerService.findAll(req.user.branchId);
  }

  @Get('printers/:id')
  @ApiOperation({ summary: 'Get printer by ID' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.printerService.findOne(id, req.user.branchId);
  }

  @Post('printers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Register a printer (Owner/Manager only)' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Request() req: any, @Body() dto: CreatePrinterDto) {
    return this.printerService.create(req.user.branchId, dto);
  }

  @Patch('printers/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update printer configuration (Owner/Manager only)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(@Param('id') id: string, @Request() req: any, @Body() dto: UpdatePrinterDto) {
    return this.printerService.update(id, req.user.branchId, body);
  }

  @Delete('printers/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Remove a printer (Owner/Manager only)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.printerService.remove(id, req.user.branchId);
  }

  @Get('print-jobs')
  @ApiOperation({ summary: 'List print jobs' })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPrintJobs(@Request() req: any, @Query('status') status?: string) {
    return this.printerService.getPrintJobs(req.user.branchId, status);
  }

  @Post('print-jobs/:id/print')
  @ApiOperation({ summary: 'Execute a print job on the configured printer' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async printJob(@Param('id') id: string, @Request() req: any) {
    return this.printerService.printJob(req.user.branchId, id);
  }

  @Post('tabs/:tabId/send-to-kds')
  @ApiOperation({ summary: 'Send tab orders to KDS and queue kitchen print' })
  @ApiParam({ name: 'tabId' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async sendToKds(@Param('tabId') tabId: string, @Request() req: any) {
    await this.printerService.sendToKds(req.user.branchId, tabId);
    return { success: true, message: 'Sent to KDS' };
  }

  @Post('tabs/:tabId/fire')
  @ApiOperation({ summary: 'Fire next round of orders for a tab' })
  @ApiParam({ name: 'tabId' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async fireOrder(@Param('tabId') tabId: string, @Request() req: any, @Body() body?: { order_ids?: string[] }) {
    return this.printerService.fireOrder(req.user.branchId, tabId, body?.order_ids);
  }

  @Post('tabs/:tabId/bump/:orderId')
  @ApiOperation({ summary: 'Bump/mark an order as complete on KDS' })
  @ApiParam({ name: 'tabId' })
  @ApiParam({ name: 'orderId' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async bumpOrder(@Param('tabId') tabId: string, @Param('orderId') orderId: string, @Request() req: any) {
    await this.printerService.bumpOrder(req.user.branchId, tabId, orderId);
    return { success: true };
  }

  @Get('kds/stream')
  @ApiOperation({ summary: 'SSE stream for KDS real-time updates' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Sse()
  kdsStream(@Request() req: any): Observable<MessageEvent> {
    return this.printerService.subscribeKds(req.user.branchId).pipe(
      map(data => ({ data }) as MessageEvent),
    );
  }
}