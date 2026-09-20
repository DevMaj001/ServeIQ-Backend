import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../role/permission-codes';
import { UserRole } from '../../common/shared';
import { RiderService } from './rider.service';
import { CreateRiderDto, UpdateRiderDto } from './dto/rider.dto';

@ApiTags('Riders')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('riders')
export class RiderController {
  constructor(private readonly riderService: RiderService) {}

  @Get()
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERADMIN)
  @RequirePermissions(PERMISSIONS.VIEW_RIDERS, PERMISSIONS.MANAGE_RIDERS)
  @ApiOperation({ summary: 'List delivery riders for the business' })
  async findAll(@Request() req: any, @Query('branch_id') branchId?: string) {
    return this.riderService.findAll(req.user.businessId, branchId);
  }

  @Post()
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERADMIN)
  @RequirePermissions(PERMISSIONS.MANAGE_RIDERS)
  @ApiOperation({
    summary: 'Create a delivery rider (creates a rider user account)',
  })
  async create(
    @Request() req: any,
    @Body() body: CreateRiderDto,
  ) {
    if (!body.full_name || !body.email || !body.password || !body.branch_id) {
      throw new ForbiddenException(
        'full_name, email, password and branch_id are required',
      );
    }
    return this.riderService.create(body, {
      businessId: req.user.businessId,
      branchId: req.user.branchId,
    });
  }

  @Patch(':id')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERADMIN)
  @RequirePermissions(PERMISSIONS.MANAGE_RIDERS)
  @ApiOperation({
    summary: 'Update a rider (branch, vehicle, online state, active)',
  })
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: UpdateRiderDto,
  ) {
    return this.riderService.update(id, req.user.businessId, body);
  }

  @Delete(':id')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERADMIN)
  @RequirePermissions(PERMISSIONS.MANAGE_RIDERS)
  @ApiOperation({ summary: 'Remove a delivery rider' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.riderService.remove(id, req.user.businessId);
  }

  @Post('me/toggle-online')
  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Toggle the current rider callers online availability',
  })
  async toggleOnline(@Request() req: any) {
    return this.riderService.toggleOnline(req.user.userId);
  }
}
