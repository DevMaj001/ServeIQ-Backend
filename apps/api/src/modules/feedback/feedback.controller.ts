import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/shared';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('Feedback')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.OWNER,
  UserRole.MANAGER,
  UserRole.SUPERVISOR,
  UserRole.WAITER,
  UserRole.CHEF,
  UserRole.CASHIER,
)
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @ApiOperation({
    summary: 'Submit beta feedback (all staff roles)',
  })
  @ApiResponse({ status: 200, description: 'Feedback submitted.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async create(@Request() req: any, @Body() dto: CreateFeedbackDto) {
    return this.feedbackService.create(req.user, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List feedback for the current business (all staff roles)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['open', 'in_review', 'resolved'],
  })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'page', required: false, example: '1' })
  @ApiQuery({ name: 'limit', required: false, example: '50' })
  @ApiResponse({ status: 200, description: 'Paginated feedback entries.' })
  async findAll(@Request() req: any, @Query() query: any) {
    return this.feedbackService.findAll(req.user, query);
  }
}
