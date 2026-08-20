import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Res,
  Header,
  NotFoundException,
} from '@nestjs/common';
import { BranchService } from './branch.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../role/permission-codes';
import { UserRole } from '../../common/shared';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { UpdateBranchSettingsDto } from './dto/update-branch-settings.dto';
import { DashboardStatsDto } from './dto/dashboard-stats.dto';
import { Branch } from './entities/branch.entity';
import { PlatformPaymentProvider } from '../admin/entities/platform-payment-provider.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as QRCode from 'qrcode';
import { Response } from 'express';

@ApiTags('Branches')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('branches')
export class BranchController {
  constructor(
    private readonly branchService: BranchService,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(PlatformPaymentProvider)
    private readonly platformPaymentProviderRepo: Repository<PlatformPaymentProvider>,
  ) {}

  @Get('payment-providers')
  @ApiOperation({
    summary:
      'List globally-available payment providers defined by the super admin',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of enabled platform payment providers.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async listPlatformPaymentProviders() {
    const providers = await this.platformPaymentProviderRepo.find({
      where: { is_active: true },
      order: { label: 'ASC' },
    });
    return providers.map((p) => ({
      name: p.name,
      label: p.label,
      type: p.type,
      verification_method: p.verification_method,
    }));
  }

  @Get()
  @ApiOperation({ summary: 'List all branches for the authenticated business' })
  @ApiResponse({
    status: 200,
    description: 'Array of branch records.',
    type: [Branch],
  })
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
  @ApiResponse({
    status: 200,
    description: 'Dashboard statistics.',
    type: DashboardStatsDto,
  })
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
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() updateDto: UpdateBranchDto,
  ) {
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
  async generateQr(
    @Param('id') id: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
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

  @Patch(':id/settings')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERADMIN)
  @RequirePermissions(PERMISSIONS.RESTAURANT_SETTINGS)
  @ApiOperation({
    summary:
      'Update branch settings (payment provider, webhook keys, takeaway policy)',
  })
  @ApiParam({ name: 'id', description: 'Branch UUID' })
  @ApiResponse({ status: 200, description: 'Settings updated.' })
  @ApiResponse({ status: 404, description: 'Branch not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async updateSettings(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: UpdateBranchSettingsDto,
  ) {
    const branch = await this.branchService.findOne(id, req.user.businessId);
    if (!branch) throw new NotFoundException('Branch not found');
    const currentSettings = branch.settings || {};
    const newSettings = { ...currentSettings, ...dto.settings };
    branch.settings = newSettings;
    return this.branchRepository.save(branch);
  }

  @Get(':id/feature-flags')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.SUPERVISOR,
    UserRole.WAITER,
    UserRole.CHEF,
    UserRole.CASHIER,
  )
  @ApiOperation({ summary: 'Get feature flags for the branch' })
  @ApiParam({ name: 'id', description: 'Branch UUID' })
  @ApiResponse({ status: 200, description: 'Feature flags object.' })
  @ApiResponse({ status: 404, description: 'Branch not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getFeatureFlags(@Param('id') id: string, @Request() req: any) {
    const branch = await this.branchService.findOne(id, req.user.businessId);
    if (!branch) throw new NotFoundException('Branch not found');
    return (branch.settings?.feature_flags as Record<string, boolean>) || {};
  }

  @Patch(':id/feature-flags')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERADMIN)
  @RequirePermissions(PERMISSIONS.RESTAURANT_SETTINGS)
  @ApiOperation({
    summary: 'Update per-branch feature flags (e.g. kds_enabled, tip_pooling)',
  })
  @ApiParam({ name: 'id', description: 'Branch UUID' })
  @ApiResponse({ status: 200, description: 'Feature flags updated.' })
  @ApiResponse({ status: 404, description: 'Branch not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async updateFeatureFlags(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: Record<string, boolean>,
  ) {
    const branch = await this.branchService.findOne(id, req.user.businessId);
    if (!branch) throw new NotFoundException('Branch not found');
    const currentFlags =
      (branch.settings?.feature_flags as Record<string, boolean>) || {};
    const merged = { ...currentFlags, ...dto };
    branch.settings = {
      ...(branch.settings || {}),
      feature_flags: merged,
    };
    await this.branchRepository.save(branch);
    return merged;
  }
}
