import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
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
  async findAll(@Request() req: any) {
    return this.adService.findAll(req.user.branchId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single advertisement' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.adService.findOne(id, req.user.branchId);
  }

  @Post()
  @ApiOperation({ summary: 'Create advertisement' })
  async create(@Request() req: any, @Body() body: any) {
    return this.adService.create(req.user.branchId, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update advertisement' })
  async update(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.adService.update(id, req.user.branchId, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete advertisement' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.adService.remove(id, req.user.branchId);
  }
}
