import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Res, Header } from '@nestjs/common';
import { BranchService } from './branch.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/shared';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { DashboardStatsDto } from './dto/dashboard-stats.dto';
import { Branch } from './entities/branch.entity';
import * as QRCode from 'qrcode';
import { Response } from 'express';

@ApiTags('Branches')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('branches')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Get()
  @ApiOperation({ summary: 'List all branches for the authenticated business' })
  @ApiResponse({ status: 200, description: 'Array of branch records.', type: [Branch] })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findAll(@Request() req: any) {
    return this.branchService.findAllByBusiness(req.user.businessId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single branch by ID' })
  @ApiParam({ name: 'id', description: 'Branch UUID', example: 'a1b2c3d4-...' })
  @ApiResponse({ status: 200, description: 'Branch record.', type: Branch })
  @ApiResponse({ status: 404, description: 'Branch not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.branchService.findOne(id, req.user.businessId);
  }

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Get dashboard stats for the authenticated branch' })
  @ApiResponse({ status: 200, description: 'Dashboard statistics.', type: DashboardStatsDto })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getDashboardStats(@Request() req: any) {
    return this.branchService.getDashboardStats(req.user.branchId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Create a new branch (Owner only)' })
  @ApiResponse({ status: 201, description: 'Branch created.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async create(@Request() req: any, @Body() createDto: CreateBranchDto) {
    return this.branchService.create({
      ...createDto,
      business_id: req.user.businessId,
    });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Update a branch (Owner only)' })
  @ApiParam({ name: 'id', description: 'Branch UUID', example: 'a1b2c3d4-...' })
  @ApiResponse({ status: 200, description: 'Branch updated.' })
  @ApiResponse({ status: 404, description: 'Branch not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async update(@Param('id') id: string, @Request() req: any, @Body() updateDto: UpdateBranchDto) {
    return this.branchService.update(id, req.user.businessId, updateDto);
  }

  @Post(':id/generate-qr')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Generate QR code for the branch public menu' })
  @ApiParam({ name: 'id', description: 'Branch UUID' })
  @ApiResponse({ status: 200, description: 'QR code PNG image.' })
  @ApiResponse({ status: 404, description: 'Branch not found.' })
  @Header('Content-Type', 'image/png')
  async generateQr(@Param('id') id: string, @Request() req: any, @Res() res: Response) {
    const branch = await this.branchService.findOne(id, req.user.businessId);

    const baseUrl = process.env.PUBLIC_MENU_BASE_URL || 'http://localhost:3000';
    const menuUrl = `${baseUrl}/public/menu/${branch.id}`;

    const pngBuffer = await QRCode.toBuffer(menuUrl, {
      type: 'png',
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    res.send(pngBuffer);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Delete a branch (Owner only)' })
  @ApiParam({ name: 'id', description: 'Branch UUID' })
  @ApiResponse({ status: 200, description: 'Branch deleted.' })
  @ApiResponse({ status: 404, description: 'Branch not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.branchService.remove(id, req.user.businessId);
  }
}


