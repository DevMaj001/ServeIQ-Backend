import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiHeader } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CustomerService } from './customer.service';

@ApiTags('Customer Self-Service')
@Controller('public')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post('tabs')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Open a self-service tab (no auth required)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['branch_id'],
      properties: {
        branch_id: { type: 'string', example: 'branch-uuid' },
        table_id: { type: 'string', example: 'table-uuid (required for dine-in)' },
        tab_type: { type: 'string', enum: ['dine_in', 'takeaway'], example: 'dine_in' },
        customer_name: { type: 'string', example: 'John Doe' },
        party_size: { type: 'number', example: 2 },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Tab opened successfully.' })
  @ApiResponse({ status: 404, description: 'Table not found.' })
  @ApiResponse({ status: 403, description: 'Table is being served by a waiter.' })
  async openTab(
    @Body() body: { branch_id: string; table_id?: string; customer_name?: string; party_size?: number; tab_type?: string },
  ) {
    if (!body.branch_id) {
      throw new BadRequestException('branch_id is required');
    }
    return this.customerService.openTab(body);
  }

  @Post('tabs/:tabId/orders')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Place orders on a self-service tab (tracking code required)' })
  @ApiParam({ name: 'tabId', description: 'Tab UUID' })
  @ApiHeader({ name: 'x-tracking-code', required: true, description: 'Tracking code for the tab' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['items'],
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            required: ['menu_item_id', 'quantity'],
            properties: {
              menu_item_id: { type: 'string' },
              quantity: { type: 'number' },
              notes: { type: 'string' },
              modifiers: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Orders placed successfully.' })
  async addItems(
    @Param('tabId') tabId: string,
    @Headers('x-tracking-code') trackingCode: string,
    @Body() body: { items: { menu_item_id: string; quantity: number; notes?: string; modifiers?: any[] }[] },
  ) {
    if (!trackingCode) throw new BadRequestException('x-tracking-code header is required');
    if (!body.items || body.items.length === 0) throw new BadRequestException('At least one item is required');
    return this.customerService.addItems(tabId, trackingCode, body.items);
  }

  @Get('tabs/:tabId')
  @ApiOperation({ summary: 'Get self-service tab status (tracking code required)' })
  @ApiParam({ name: 'tabId', description: 'Tab UUID' })
  @ApiHeader({ name: 'x-tracking-code', required: true, description: 'Tracking code for the tab' })
  @ApiResponse({ status: 200, description: 'Tab status with orders.' })
  async getTab(
    @Param('tabId') tabId: string,
    @Headers('x-tracking-code') trackingCode: string,
  ) {
    if (!trackingCode) throw new BadRequestException('x-tracking-code header is required');
    return this.customerService.getTab(tabId, trackingCode);
  }
}