import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DeviceService } from './device.service';
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

@ApiTags('Devices')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('devices')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @RequirePermissions(PERMISSIONS.MANAGE_DEVICES)
  @ApiOperation({
    summary: 'List all registered devices for the business',
    description:
      'Returns tablets, phones and terminals that have logged in for this business. Use revoke to block a lost device.',
  })
  @ApiResponse({ status: 200, description: 'Array of registered devices.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async list(@Request() req: any) {
    return this.deviceService.listForBusiness(req.user.businessId);
  }

  @Post(':id/revoke')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @RequirePermissions(PERMISSIONS.MANAGE_DEVICES)
  @ApiOperation({ summary: 'Revoke a device (blocks future logins)' })
  @ApiParam({ name: 'id', description: 'Device UUID' })
  @ApiResponse({ status: 200, description: 'Device revoked.' })
  @ApiResponse({ status: 404, description: 'Device not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async revoke(@Request() req: any, @Param('id') id: string) {
    return this.deviceService.revoke(id, req.user.businessId);
  }

  @Post(':id/reactivate')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @RequirePermissions(PERMISSIONS.MANAGE_DEVICES)
  @ApiOperation({ summary: 'Reactivate a previously revoked device' })
  @ApiParam({ name: 'id', description: 'Device UUID' })
  @ApiResponse({ status: 200, description: 'Device reactivated.' })
  @ApiResponse({ status: 404, description: 'Device not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async reactivate(@Request() req: any, @Param('id') id: string) {
    return this.deviceService.reactivate(id, req.user.businessId);
  }
}