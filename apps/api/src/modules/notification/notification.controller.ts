import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
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
import { MarkReadDto } from './dto/mark-read.dto';

const ALL_STAFF = [
  UserRole.OWNER,
  UserRole.MANAGER,
  UserRole.SUPERVISOR,
  UserRole.WAITER,
  UserRole.CHEF,
  UserRole.CASHIER,
];

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @Roles(...ALL_STAFF)
  @ApiOperation({ summary: 'List notifications for the current branch' })
  @ApiQuery({
    name: 'unreadOnly',
    required: false,
    type: Boolean,
    example: true,
  })
  @ApiResponse({ status: 200, description: 'List of notifications.' })
  async findAll(@Request() req: any, @Query('unreadOnly') unreadOnly?: string) {
    return this.notificationService.findAll(
      req.user.branchId,
      unreadOnly === 'true',
    );
  }

  @Get('count')
  @Roles(...ALL_STAFF)
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: 200, description: 'Unread count.' })
  async getUnreadCount(@Request() req: any) {
    const count = await this.notificationService.getUnreadCount(
      req.user.branchId,
    );
    return { count };
  }

  @Get(':id')
  @Roles(...ALL_STAFF)
  @ApiOperation({ summary: 'Get a notification by ID' })
  @ApiParam({ name: 'id', description: 'Notification UUID' })
  @ApiResponse({ status: 200, description: 'Notification details.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.notificationService.findOne(id, req.user.branchId);
  }

  @Patch('read')
  @Roles(...ALL_STAFF)
  @ApiOperation({ summary: 'Mark specific notifications as read' })
  @ApiResponse({ status: 200, description: 'Marked as read.' })
  async markAsRead(@Request() req: any, @Body() dto: MarkReadDto) {
    return this.notificationService.markAsRead(dto.ids, req.user.branchId);
  }

  @Patch(':id/read')
  @Roles(...ALL_STAFF)
  @ApiOperation({ summary: 'Mark a single notification as read' })
  @ApiParam({ name: 'id', description: 'Notification UUID' })
  @ApiResponse({ status: 200, description: 'Marked as read.' })
  async markOneAsRead(@Param('id') id: string, @Request() req: any) {
    return this.notificationService.markAsRead([id], req.user.branchId);
  }

  @Patch('read-all')
  @Roles(...ALL_STAFF)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All marked as read.' })
  async markAllAsRead(@Request() req: any) {
    return this.notificationService.markAllAsRead(req.user.branchId);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiParam({ name: 'id', description: 'Notification UUID' })
  @ApiResponse({ status: 200, description: 'Notification deleted.' })
  async delete(@Param('id') id: string, @Request() req: any) {
    return this.notificationService.delete(id, req.user.branchId);
  }
}
