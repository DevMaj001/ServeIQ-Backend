import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/shared';
import { AdvertisementService } from './advertisement.service';

@ApiTags('Advertisements')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
@Controller('advertisements')
export class AdvertisementController {
  constructor(private readonly adService: AdvertisementService) {}

  @Get()
  @ApiOperation({ summary: 'List all advertisements for the branch' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  async findAll(@Request() req: any, @Query('branch_id') branchId?: string) {
    return this.adService.findAll(branchId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single advertisement' })
  @ApiParam({ name: 'id', description: 'Advertisement UUID' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.adService.findOne(id, req.user.branchId);
  }

  @Post()
  @ApiOperation({ summary: 'Create advertisement' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  async create(@Request() req: any, @Body() body: any) {
    const branchId = body.branch_id || req.user.branchId;
    return this.adService.create(branchId, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update advertisement' })
  @ApiParam({ name: 'id', description: 'Advertisement UUID' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  async update(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.adService.update(id, req.user.branchId, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete advertisement' })
  @ApiParam({ name: 'id', description: 'Advertisement UUID' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.adService.remove(id, req.user.branchId);
  }
}
