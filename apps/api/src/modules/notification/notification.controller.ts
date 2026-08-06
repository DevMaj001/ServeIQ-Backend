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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { MarkReadDto } from './dto/mark-read.dto';

interface RequestWithUser {
  user: {
    branchId: string;
  };
}

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the current branch' })
  @ApiQuery({
    name: 'unreadOnly',
    required: false,
    type: Boolean,
    example: true,
  })
  @ApiResponse({ status: 200, description: 'List of notifications.' })
  async findAll(
    @Request() req: RequestWithUser,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationService.findAll(
      req.user.branchId,
      unreadOnly === 'true',
    );
  }

  @Get('count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: 200, description: 'Unread count.' })
  async getUnreadCount(@Request() req: RequestWithUser) {
    const count = await this.notificationService.getUnreadCount(
      req.user.branchId,
    );
    return { count };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a notification by ID' })
  @ApiParam({ name: 'id', description: 'Notification UUID' })
  @ApiResponse({ status: 200, description: 'Notification details.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  async findOne(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.notificationService.findOne(id, req.user.branchId);
  }

  @Patch('read')
  @ApiOperation({ summary: 'Mark specific notifications as read' })
  @ApiResponse({ status: 200, description: 'Marked as read.' })
  async markAsRead(@Request() req: RequestWithUser, @Body() dto: MarkReadDto) {
    return this.notificationService.markAsRead(dto.ids, req.user.branchId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  @ApiParam({ name: 'id', description: 'Notification UUID' })
  @ApiResponse({ status: 200, description: 'Marked as read.' })
  async markOneAsRead(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.notificationService.markAsRead([id], req.user.branchId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All marked as read.' })
  async markAllAsRead(@Request() req: RequestWithUser) {
    return this.notificationService.markAllAsRead(req.user.branchId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiParam({ name: 'id', description: 'Notification UUID' })
  @ApiResponse({ status: 200, description: 'Notification deleted.' })
  async delete(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.notificationService.delete(id, req.user.branchId);
  }
}
