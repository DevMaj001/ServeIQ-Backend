import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/shared';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { AdminFeedbackUpdateStatusDto } from './dto/update-feedback-status.dto';

@ApiTags('Admin Feedback')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
@Controller('admin/feedback')
export class AdminFeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get()
  @ApiOperation({ summary: 'Super admin — list all platform feedback' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['open', 'in_review', 'resolved'],
  })
  @ApiQuery({ name: 'page', required: false, example: '1' })
  @ApiQuery({ name: 'limit', required: false, example: '50' })
  @ApiResponse({ status: 200, description: 'Paginated platform feedback.' })
  async findAll(@Query() query: any) {
    return this.feedbackService.findAllForPlatform(query);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Super admin — update feedback status / notes' })
  @ApiParam({ name: 'id', description: 'Feedback UUID' })
  @ApiResponse({ status: 200, description: 'Feedback updated.' })
  @ApiResponse({ status: 404, description: 'Feedback not found.' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: AdminFeedbackUpdateStatusDto,
  ) {
    const updated = await this.feedbackService.updateStatus(
      id,
      dto.status,
      dto.admin_notes,
    );
    if (!updated) throw new NotFoundException('Feedback not found');
    return updated;
  }
}
