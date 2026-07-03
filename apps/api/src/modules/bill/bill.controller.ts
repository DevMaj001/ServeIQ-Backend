import { Controller, Get, Post, Body, Param, UseGuards, Request, Res } from '@nestjs/common';
import { Response } from 'express';
import { BillService } from './bill.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiProduces } from '@nestjs/swagger';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { GenerateBillDto } from './dto/generate-bill.dto';
import { ApplyDiscountDto } from './dto/apply-discount.dto';

@ApiTags('Bills')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('bills')
export class BillController {
  constructor(private readonly billService: BillService) {}

  @Post('tab/:tabId/generate')
  @ApiOperation({ summary: 'Generate a bill for an open tab' })
  @ApiParam({ name: 'tabId', description: 'Tab UUID', example: 'tab-uuid-here' })
  @ApiBody({ type: GenerateBillDto, required: false })
  @ApiResponse({ status: 201, description: 'Bill generated successfully.' })
  @ApiResponse({ status: 404, description: 'Tab not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async generateBill(
    @Param('tabId') tabId: string,
    @Request() req: any,
    @Body() generateBillDto?: GenerateBillDto,
  ) {
    return this.billService.generateBill(tabId, req.user.userId, req.user.role, generateBillDto);
  }

  @Post('tab/:tabId/apply-discount')
  @ApiOperation({ summary: 'Apply a discount to a bill (fixed kobo or percentage)' })
  @ApiParam({ name: 'tabId' })
  async applyDiscount(@Param('tabId') tabId: string, @Body() dto: ApplyDiscountDto) {
    return this.billService.applyDiscount(tabId, dto);
  }

  @Post('tab/:tabId/pay')
  @ApiOperation({ summary: 'Process payment for a tab bill' })
  @ApiParam({ name: 'tabId', description: 'Tab UUID', example: 'tab-uuid-here' })
  @ApiBody({ type: ProcessPaymentDto })
  @ApiResponse({ status: 200, description: 'Payment processed, tab closed.' })
  @ApiResponse({ status: 404, description: 'Tab not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async payBill(
    @Param('tabId') tabId: string,
    @Request() req: any,
    @Body() paymentDto: ProcessPaymentDto,
  ) {
    return this.billService.processPayment(tabId, req.user.userId, req.user.role, paymentDto);
  }

  @Get('tab/:tabId/receipt')
  @ApiOperation({ summary: 'Get receipt details as JSON' })
  @ApiParam({ name: 'tabId', description: 'Tab UUID', example: 'tab-uuid-here' })
  @ApiResponse({ status: 200, description: 'Receipt details.' })
  @ApiResponse({ status: 404, description: 'Tab or bill not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getReceipt(@Param('tabId') tabId: string) {
    return this.billService.getReceipt(tabId);
  }

  @Get('tab/:tabId/receipt/pdf')
  @ApiOperation({ summary: 'Download receipt as PDF' })
  @ApiParam({ name: 'tabId', description: 'Tab UUID', example: 'tab-uuid-here' })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'PDF receipt.' })
  @ApiResponse({ status: 404, description: 'Tab or bill not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getReceiptPdf(@Param('tabId') tabId: string, @Res() res: Response) {
    const pdf = await this.billService.getReceiptPdf(tabId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="receipt-${tabId}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }
}


