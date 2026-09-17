import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../role/permission-codes';
import { UserRole } from '../../common/shared';
import { ReservationsService } from './reservations.service';
import {
  CreateReservationDto,
  UpdateReservationDto,
  ReservationQueryDto,
  AvailabilityQueryDto,
  WalkinReservationDto,
  ConfirmReservationDto,
  CancelReservationDto,
} from './dto/reservation.dto';

@ApiTags('Reservations')
@ApiBearerAuth('access-token')
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  // ===== PUBLIC ENDPOINTS (no auth) =====

  @Get('availability')
  @ApiOperation({ summary: 'Check available time slots for a date/party size (public)' })
  async checkAvailability(@Query() query: AvailabilityQueryDto) {
    return this.reservationsService.checkAvailabilitySlots(query);
  }

  @Post('book')
  @ApiOperation({ summary: 'Create a new reservation (public)' })
  async createPublic(@Body() dto: CreateReservationDto, @Request() req: any) {
    // For public booking, branch_id comes from query param or header
    const branchId = req.headers['x-branch-id'] || req.query.branch_id;
    if (!branchId) throw new BadRequestException('Branch ID required');
    return this.reservationsService.create(dto, branchId);
  }

  @Get('confirm/:code')
  @ApiOperation({ summary: 'Confirm reservation by confirmation code (public)' })
  async confirmByCode(@Param('code') code: string) {
    return this.reservationsService.confirmByCode(code);
  }

  @Post('cancel/:code')
  @ApiOperation({ summary: 'Cancel reservation by confirmation code (public)' })
  async cancelByCode(@Param('code') code: string, @Body() body: CancelReservationDto) {
    return this.reservationsService.cancelByCode(code, body.reason ?? null);
  }

  @Get('lookup/:code')
  @ApiOperation({ summary: 'Look up reservation by confirmation code (public)' })
  async lookupByCode(@Param('code') code: string) {
    return this.reservationsService.findByConfirmationCode(code);
  }

  // ===== ADMIN/MANAGER ENDPOINTS =====

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.SUPERADMIN)
  @RequirePermissions(PERMISSIONS.MANAGE_RESERVATIONS)
  @ApiOperation({ summary: 'List reservations (manager view)' })
  async list(@Request() req: any, @Query() query: ReservationQueryDto) {
    return this.reservationsService.findAll(query, req.user);
  }

  @Get('today')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.SUPERADMIN)
  @RequirePermissions(PERMISSIONS.MANAGE_RESERVATIONS)
  @ApiOperation({ summary: 'Get today\'s reservation summary' })
  async todaySummary(@Request() req: any) {
    return this.reservationsService.getTodaySummary(req.user.branchId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.SUPERADMIN)
  @RequirePermissions(PERMISSIONS.MANAGE_RESERVATIONS)
  @ApiOperation({ summary: 'Get reservation by ID' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.reservationsService.findById(id, req.user.businessId);
  }

  @Post('walkin')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.SUPERADMIN)
  @RequirePermissions(PERMISSIONS.OPEN_TABLE)
  @ApiOperation({ summary: 'Create walk-in reservation (seats immediately)' })
  async createWalkin(@Body() dto: WalkinReservationDto, @Request() req: any) {
    return this.reservationsService.createWalkin(dto, req.user.branchId, req.user.userId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.SUPERADMIN)
  @RequirePermissions(PERMISSIONS.MANAGE_RESERVATIONS)
  @ApiOperation({ summary: 'Update reservation (time, party, status, etc.)' })
  async update(@Param('id') id: string, @Body() dto: UpdateReservationDto, @Request() req: any) {
    return this.reservationsService.update(id, req.user.businessId, dto, req.user.userId);
  }

  @Patch(':id/seat')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.SUPERADMIN)
  @RequirePermissions(PERMISSIONS.OPEN_TABLE)
  @ApiOperation({ summary: 'Seat a confirmed reservation (creates tab)' })
  async seat(@Param('id') id: string, @Request() req: any) {
    return this.reservationsService.seatWalkin(id, req.user.branchId);
  }

  @Post('reminders/send')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERADMIN)
  @RequirePermissions(PERMISSIONS.MANAGE_RESERVATIONS)
  @ApiOperation({ summary: 'Manually trigger reservation reminders' })
  async sendReminders() {
    const sent = await this.reservationsService.sendReminders();
    return { sent };
  }
}