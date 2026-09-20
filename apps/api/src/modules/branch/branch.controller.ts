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
import { EncryptionService } from '../../common/services/encryption.service';
import {
  encryptSensitiveConfig,
  sanitizeSettingsForResponse,
  stripMaskedSecrets,
} from '../payment/provider-secrets';

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
    private readonly encryptionService: EncryptionService,
  ) {}

  /** Branch entities carry payment-provider secrets inside settings; every
   *  response leaves through this so a staff token can never read a webhook
   *  secret back. Never mutates the entity (the same object may be saved). */
  private toResponse(branch: Branch): Branch {
    if (!branch?.settings) return branch;
    return {
      ...branch,
      settings: sanitizeSettingsForResponse(
        branch.settings,
        this.encryptionService,
      ),
    } as Branch;
  }

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
    const branches = await this.branchService.findAllByBusiness(
      req.user.businessId,
    );
    return branches.map((b) => this.toResponse(b));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single branch by ID' })
  @ApiParam({ name: 'id', description: 'Branch UUID', example: 'a1b2c3d4-...' })
  @ApiResponse({ status: 200, description: 'Branch record.', type: Branch })
  @ApiResponse({ status: 404, description: 'Branch not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.toResponse(
      await this.branchService.findOne(id, req.user.businessId),
    );
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
    return this.toResponse(
      await this.branchService.update(id, req.user.businessId, updateDto),
    );
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
    const newSettings = this.mergeBranchSettings(currentSettings, dto.settings);
    if (dto.delivery) {
      newSettings.delivery = {
        ...(currentSettings.delivery || {}),
        ...dto.delivery,
      };
    }
    if (dto.reservation) {
      newSettings.reservation = {
        ...(currentSettings.reservation || {}),
        ...dto.reservation,
      };
    }
    if (dto.kds_default_department_id !== undefined) {
      newSettings.kds_default_department_id = dto.kds_default_department_id;
    }
    // Secrets are stored encrypted at rest; a value the client did not
    // change (it only ever saw the mask) was already dropped in the merge.
    if (Array.isArray(newSettings.payment_providers)) {
      newSettings.payment_providers = newSettings.payment_providers.map(
        (p: any) =>
          p && typeof p === 'object'
            ? {
                ...p,
                config: encryptSensitiveConfig(
                  p.config,
                  this.encryptionService,
                ),
              }
            : p,
      );
    }
    branch.settings = newSettings;
    const saved = await this.branchRepository.save(branch);
    return this.toResponse(saved);
  }

  /**
   * Merge a partial settings payload into the branch's existing settings.
   *
   * `payment_providers` is UPSERTED per provider name instead of replaced so a
   * stale/partial save from the admin UI can never wipe a previously
   * configured webhook secret/key. A provider is disabled by removing it from
   * `enabled_providers`, not by clearing its config entry here.
   * `enabled_providers` is sanitized (deduped) to stop duplicate
   * accumulation like ["manual","manual","manual","monniepoint"].
   */
  private mergeBranchSettings(current: any, incoming?: any): any {
    const merged = { ...(current || {}) };

    if (incoming?.payment_provider !== undefined) {
      merged.payment_provider = incoming.payment_provider;
    }

    if (Array.isArray(incoming?.enabled_providers)) {
      merged.enabled_providers = Array.from(
        new Set(
          incoming.enabled_providers.filter(
            (name: any) => typeof name === 'string' && name.trim() !== '',
          ),
        ),
      );
    }

    if (Array.isArray(incoming?.payment_providers)) {
      const existing = Array.isArray(merged.payment_providers)
        ? merged.payment_providers
        : [];
      const mergedProviders = [...existing];
      for (const rawProvider of incoming.payment_providers) {
        if (!rawProvider || !rawProvider.name) continue;
        // A masked secret coming back from the UI means "unchanged": drop it
        // so the stored (encrypted) value survives the round-trip.
        const provider = {
          ...rawProvider,
          ...(rawProvider.config
            ? { config: stripMaskedSecrets(rawProvider.config) }
            : {}),
        };
        const index = mergedProviders.findIndex(
          (p) => p?.name === provider.name,
        );
        if (index >= 0) {
          const current = mergedProviders[index];
          const next = { ...current, ...provider };
          if (provider.config && current?.config) {
            next.config = { ...current.config, ...provider.config };
          }
          mergedProviders[index] = next;
        } else {
          mergedProviders.push(provider);
        }
      }
      merged.payment_providers = mergedProviders;
    }

    for (const key of Object.keys(incoming || {})) {
      if (
        key === 'payment_provider' ||
        key === 'enabled_providers' ||
        key === 'payment_providers'
      ) {
        continue;
      }
      merged[key] = incoming[key];
    }

    return merged;
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
