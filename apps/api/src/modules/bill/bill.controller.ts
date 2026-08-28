import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { BillService } from './bill.service';
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
  ApiBody,
  ApiProduces,
} from '@nestjs/swagger';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { GenerateBillDto } from './dto/generate-bill.dto';
import { ApplyDiscountDto } from './dto/apply-discount.dto';
import { BillSplitEvenlyDto, BillSplitByItemDto } from './dto/split-bill.dto';

@ApiTags('Bills')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('bills')
export class BillController {
  constructor(private readonly billService: BillService) {}

  @Post('tab/:tabId/generate')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.WAITER,
    UserRole.SUPERVISOR,
    UserRole.MANAGER,
    UserRole.OWNER,
  )
  @ApiOperation({ summary: 'Generate a bill for an open tab' })
  @ApiParam({
    name: 'tabId',
    description: 'Tab UUID',
    example: 'tab-uuid-here',
  })
  @ApiBody({ type: GenerateBillDto, required: false })
  @ApiResponse({ status: 201, description: 'Bill generated successfully.' })
  @ApiResponse({ status: 404, description: 'Tab not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async generateBill(
    @Param('tabId') tabId: string,
    @Request() req: any,
    @Body() generateBillDto?: GenerateBillDto,
  ) {
    return this.billService.generateBill(
      tabId,
      req.user.branchId,
      req.user.userId,
      req.user.role,
      generateBillDto,
    );
  }

  @Post('tab/:tabId/apply-discount')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERVISOR, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Apply a discount to a bill (Supervisor/Manager/Owner only)',
  })
  @ApiParam({ name: 'tabId' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async applyDiscount(
    @Param('tabId') tabId: string,
    @Request() req: any,
    @Body() dto: ApplyDiscountDto,
  ) {
    return this.billService.applyDiscount(tabId, req.user.branchId, dto);
  }

  @Post('tab/:tabId/pay')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.WAITER,
    UserRole.CASHIER,
    UserRole.SUPERVISOR,
    UserRole.MANAGER,
    UserRole.OWNER,
  )
  @ApiOperation({ summary: 'Process payment for a tab bill' })
  @ApiParam({
    name: 'tabId',
    description: 'Tab UUID',
    example: 'tab-uuid-here',
  })
  @ApiBody({ type: ProcessPaymentDto })
  @ApiResponse({ status: 200, description: 'Payment processed, tab closed.' })
  @ApiResponse({ status: 404, description: 'Tab not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async payBill(
    @Param('tabId') tabId: string,
    @Request() req: any,
    @Body() paymentDto: ProcessPaymentDto,
  ) {
    return this.billService.processPayment(
      tabId,
      req.user.branchId,
      req.user.userId,
      req.user.role,
      paymentDto,
    );
  }

  @Post('tab/:tabId/confirm-cash')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.OWNER)
  @ApiOperation({
    summary:
      'Supervisor confirms a cash payment taken at the counter and releases the takeaway order(s) to the kitchen',
  })
  @ApiParam({ name: 'tabId', description: 'Tab UUID' })
  @ApiResponse({ status: 200, description: 'Cash confirmed, order released.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async confirmCash(
    @Param('tabId') tabId: string,
    @Request() req: any,
  ) {
    return this.billService.confirmCashPayment(
      tabId,
      req.user.branchId,
      req.user.userId,
      req.user.role,
    );
  }

  @Post('tab/:tabId/split-evenly')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.WAITER,
    UserRole.CASHIER,
    UserRole.SUPERVISOR,
    UserRole.MANAGER,
    UserRole.OWNER,
  )
  @ApiOperation({ summary: 'Split the bill evenly among N ways' })
  @ApiParam({ name: 'tabId' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async splitEvenly(
    @Param('tabId') tabId: string,
    @Request() req: any,
    @Body() dto: BillSplitEvenlyDto,
  ) {
    return this.billService.splitEvenly(
      tabId,
      req.user.branchId,
      req.user.userId,
      req.user.role,
      dto.splits,
    );
  }

  @Post('tab/:tabId/split-by-item')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.WAITER,
    UserRole.CASHIER,
    UserRole.SUPERVISOR,
    UserRole.MANAGER,
    UserRole.OWNER,
  )
  @ApiOperation({ summary: 'Split the bill by assigning items to each split' })
  @ApiParam({ name: 'tabId' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async splitByItem(
    @Param('tabId') tabId: string,
    @Request() req: any,
    @Body() dto: BillSplitByItemDto,
  ) {
    return this.billService.splitByItem(
      tabId,
      req.user.branchId,
      req.user.userId,
      req.user.role,
      dto.allocations,
    );
  }

  @Get('tab/:tabId/splits')
  @ApiOperation({ summary: 'Get all split bills for a tab' })
  @ApiParam({ name: 'tabId' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSplitBills(@Param('tabId') tabId: string, @Request() req: any) {
    return this.billService.getSplitBills(tabId, req.user.branchId);
  }

  @Post('tab/:tabId/splits/:billId/pay')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.WAITER,
    UserRole.CASHIER,
    UserRole.SUPERVISOR,
    UserRole.MANAGER,
    UserRole.OWNER,
  )
  @ApiOperation({ summary: 'Pay an individual split bill' })
  @ApiParam({ name: 'tabId' })
  @ApiParam({ name: 'billId' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async paySplit(
    @Param('tabId') tabId: string,
    @Param('billId') billId: string,
    @Request() req: any,
    @Body() paymentDto: ProcessPaymentDto,
  ) {
    return this.billService.processSplitPayment(
      tabId,
      billId,
      req.user.branchId,
      req.user.userId,
      req.user.role,
      paymentDto,
    );
  }

  @Get('tab/:tabId/receipt')
  @ApiOperation({ summary: 'Get receipt details as JSON' })
  @ApiParam({
    name: 'tabId',
    description: 'Tab UUID',
    example: 'tab-uuid-here',
  })
  @ApiResponse({ status: 200, description: 'Receipt details.' })
  @ApiResponse({ status: 404, description: 'Tab or bill not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getReceipt(@Param('tabId') tabId: string, @Request() req: any) {
    return this.billService.getReceipt(tabId, req.user.branchId);
  }

  @Get('tab/:tabId/receipt/pdf')
  @ApiOperation({ summary: 'Download receipt as PDF' })
  @ApiParam({
    name: 'tabId',
    description: 'Tab UUID',
    example: 'tab-uuid-here',
  })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'PDF receipt.' })
  @ApiResponse({ status: 404, description: 'Tab or bill not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getReceiptPdf(
    @Param('tabId') tabId: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const pdf = await this.billService.getReceiptPdf(tabId, req.user.branchId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="receipt-${tabId}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }
}
