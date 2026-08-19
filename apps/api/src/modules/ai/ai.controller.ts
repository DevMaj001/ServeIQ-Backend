import {
  Controller,
  Post,
  Get,
  UseGuards,
  Body,
  Request,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/shared';
import { Throttle } from '@nestjs/throttler';
import { GenerateLogicDto } from './dto/generate-logic.dto';
import { ReportQueryDto } from './dto/report-query.dto';

@ApiTags('AI')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate-logic')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Generate perfect business logic using Nemotron AI',
  })
  @ApiBody({ type: GenerateLogicDto })
  @ApiResponse({
    status: 200,
    description: 'Business logic generated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async generateLogic(
    @Request() req: any,
    @Body() generateLogicDto: GenerateLogicDto,
  ) {
    const result = await this.aiService.generateLogic(generateLogicDto.prompt);
    return { success: true, data: result };
  }

  @Get('analyze-api')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Analyze API pros and cons for admin and waiter apps',
  })
  @ApiResponse({
    status: 200,
    description: 'API analysis completed successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async analyzeApi() {
    const result = await this.aiService.analyzeApiProsCons();
    return { success: true, data: result };
  }

  @Post('report')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERVISOR)
  @ApiOperation({
    summary:
      'Natural language sales report — ask questions about your business data',
  })
  @ApiBody({ type: ReportQueryDto })
  @ApiResponse({ status: 200, description: 'AI-powered report generated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getReport(@Request() req: any, @Body() dto: ReportQueryDto) {
    const result = await this.aiService.getSalesReport(
      req.user.branchId,
      dto.question,
      dto.dateFrom,
      dto.dateTo,
    );
    return { success: true, data: result };
  }

  @Get('insights/wastage')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary:
      'Analyze inventory wastage and slippage patterns from stock adjustments',
  })
  @ApiResponse({ status: 200, description: 'Wastage insights generated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getWastageInsights(@Request() req: any) {
    const result = await this.aiService.getWastageInsights(req.user.branchId);
    return { success: true, data: result };
  }

  @Get('insights/restock')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary:
      'Get AI-powered restock recommendations based on current stock and usage',
  })
  @ApiResponse({
    status: 200,
    description: 'Restock recommendations generated',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getRestockRecommendations(@Request() req: any) {
    const result = await this.aiService.getRestockRecommendations(
      req.user.branchId,
    );
    return { success: true, data: result };
  }
}
