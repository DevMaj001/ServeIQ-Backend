import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/shared';
import { AdvertisementService } from './advertisement.service';

@ApiTags('Advertisements')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
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
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create advertisement (Owner/Manager only)' })
  async create(@Request() req: any, @Body() body: any) {
    return this.adService.create(req.user.branchId, body);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update advertisement (Owner/Manager only)' })
  async update(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.adService.update(id, req.user.branchId, body);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete advertisement (Owner/Manager only)' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.adService.remove(id, req.user.branchId);
  }
}
