import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { OrderService } from './order.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/shared';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import { CreateOrderItemDto } from './dto/create-order-item.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ApproveOrderDto } from './dto/approve-order.dto';
import { DeclineOrderDto } from './dto/decline-order.dto';
import { Order } from './entities/order.entity';
import { getPaginationParams, paginate } from '../../common/pagination';

@ApiTags('Orders')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post('tab/:tabId')
  @ApiOperation({ summary: 'Add order items to an open tab (creates as PENDING_SUPERVISOR_APPROVAL)' })
  @ApiParam({ name: 'tabId', description: 'Tab UUID', example: 'tab-uuid-here' })
  @ApiBody({ type: [CreateOrderItemDto] })
  @ApiResponse({ status: 201, description: 'Order items added to tab.', type: [Order] })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async addItems(@Param('tabId') tabId: string, @Request() req: any, @Body() items: CreateOrderItemDto[]) {
    return this.orderService.addOrderItems(tabId, items, req.user.userId);
  }

  // ── Static routes must come BEFORE :id ──
  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPERVISOR, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ summary: 'Get pending approval orders (paginated)' })
  @ApiQuery({ name: 'page', required: false, example: '1' })
  @ApiQuery({ name: 'per_page', required: false, example: '20' })
  @ApiResponse({ status: 200, description: 'Paginated pending orders list.' })
  async findPending(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('per_page') per_page?: string,
  ) {
    const pagination = getPaginationParams({ page, per_page });
    const { data, total } = await this.orderService.findPendingByBranch(
      req.user.branchId, req.user.userId, req.user.role, pagination,
    );
    return paginate(data, total, pagination);
  }

  @Get('preparing')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPERVISOR, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ summary: 'Get currently preparing orders with active countdowns' })
  @ApiResponse({ status: 200, description: 'Preparing orders list.' })
  async findPreparing(@Request() req: any) {
    return this.orderService.findPreparingByBranch(req.user.branchId);
  }

  @Get('ready-for-pickup')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPERVISOR, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ summary: 'Get orders ready for pickup (timer expired)' })
  @ApiResponse({ status: 200, description: 'Ready for pickup orders list.' })
  async findReadyForPickup(@Request() req: any) {
    return this.orderService.findReadyForPickupByBranch(req.user.branchId);
  }

  @Get('tab/:tabId')
  @ApiOperation({ summary: 'Get all orders for a specific tab' })
  @ApiParam({ name: 'tabId', description: 'Tab UUID', example: 'tab-uuid-here' })
  @ApiResponse({ status: 200, description: 'List of order items for the tab.', type: [Order] })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findByTab(@Param('tabId') tabId: string) {
    return this.orderService.findByTab(tabId);
  }

  // ── :id routes ──
  @Get(':id')
  @ApiOperation({ summary: 'Get a specific order item by ID' })
  @ApiParam({ name: 'id', description: 'Order item UUID' })
  @ApiResponse({ status: 200, description: 'Order item details.' })
  @ApiResponse({ status: 404, description: 'Order item not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findOne(@Param('id') id: string) {
    return this.orderService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPERVISOR, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update order item (Supervisor/Manager/Owner only)' })
  @ApiParam({ name: 'id', description: 'Order item UUID' })
  @ApiResponse({ status: 200, description: 'Order item updated.' })
  @ApiResponse({ status: 404, description: 'Order item not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async update(@Param('id') id: string, @Request() req: any, @Body() updateDto: UpdateOrderDto) {
    return this.orderService.updateOrder(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPERVISOR, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Remove order item (Supervisor/Manager/Owner only)' })
  @ApiParam({ name: 'id', description: 'Order item UUID' })
  @ApiResponse({ status: 200, description: 'Order item removed.' })
  @ApiResponse({ status: 404, description: 'Order item not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async remove(@Param('id') id: string) {
    return this.orderService.removeOrder(id);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPERVISOR, UserRole.OWNER)
  @ApiOperation({ summary: 'Approve a pending order (Supervisor/Owner only) — requires department + prep time' })
  @ApiParam({ name: 'id', description: 'Order item UUID' })
  @ApiBody({ type: ApproveOrderDto })
  @ApiResponse({ status: 200, description: 'Order approved and timer started.' })
  @ApiResponse({ status: 400, description: 'Preparation time is required.' })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  async approve(@Param('id') id: string, @Request() req: any, @Body() dto: ApproveOrderDto) {
    return this.orderService.approve(id, req.user.userId, dto);
  }

  @Post(':id/decline')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPERVISOR, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Decline a pending order (Supervisor only) — requires reason' })
  @ApiParam({ name: 'id', description: 'Order item UUID' })
  @ApiBody({ type: DeclineOrderDto })
  @ApiResponse({ status: 200, description: 'Order declined.' })
  @ApiResponse({ status: 400, description: 'Decline reason is required.' })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  async decline(@Param('id') id: string, @Request() req: any, @Body() dto: DeclineOrderDto) {
    return this.orderService.decline(id, req.user.userId, dto);
  }

  @Post(':id/confirm-pickup')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERVISOR)
  @ApiOperation({ summary: 'Confirm waiter has picked up the order (Owner/Manager/Supervisor)' })
  @ApiParam({ name: 'id', description: 'Order item UUID' })
  @ApiResponse({ status: 200, description: 'Order marked as out for delivery.' })
  @ApiResponse({ status: 400, description: 'Order is not ready for pickup.' })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  async confirmPickup(@Param('id') id: string, @Request() req: any) {
    return this.orderService.confirmPickup(id, req.user.userId);
  }

  @Post(':id/deliver')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.WAITER)
  @ApiOperation({ summary: 'Confirm delivery (Owner/Manager/Supervisor/Waiter)' })
  @ApiParam({ name: 'id', description: 'Order item UUID' })
  @ApiResponse({ status: 200, description: 'Order marked as delivered.' })
  @ApiResponse({ status: 400, description: 'Order is not ready for pickup.' })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  async deliver(@Param('id') id: string, @Request() req: any) {
    return this.orderService.deliver(id, req.user.userId);
  }
}
