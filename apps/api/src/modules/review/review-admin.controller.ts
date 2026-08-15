import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../role/permission-codes';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('Admin Reviews')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/reviews')
export class AdminReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.VIEW_FEEDBACK)
  @ApiOperation({ summary: 'Business reviews — paginated with avg rating' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'rating', required: false })
  @ApiQuery({ name: 'minRating', required: false })
  @ApiQuery({ name: 'page', required: false, example: '1' })
  @ApiQuery({ name: 'limit', required: false, example: '50' })
  @ApiResponse({ status: 200, description: 'Paginated business reviews.' })
  async findAll(@Request() req: any, @Query() query: any) {
    return this.reviewService.findAllForBusiness(req.user.businessId, query);
  }
}