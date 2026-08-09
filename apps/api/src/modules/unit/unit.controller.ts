import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../role/permission-codes';
import { UserRole } from '../../common/shared';
import { UnitService } from './unit.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@ApiTags('Units')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.MANAGER)
@Controller('units')
export class UnitController {
  constructor(private readonly unitService: UnitService) {}

  @Get()
  @Roles(
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.WAITER,
    UserRole.CHEF,
    UserRole.CASHIER,
    UserRole.SUPERVISOR,
  )
  @ApiOperation({ summary: 'Get all units for the branch' })
  @ApiResponse({ status: 200, description: 'List of units.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findAll(@Request() req: any) {
    return this.unitService.findAllByBranch(req.user.branchId);
  }

  @Get(':id')
  @Roles(
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.WAITER,
    UserRole.CHEF,
    UserRole.CASHIER,
    UserRole.SUPERVISOR,
  )
  @ApiOperation({ summary: 'Get a unit by ID' })
  @ApiParam({ name: 'id', description: 'Unit UUID' })
  @ApiResponse({ status: 200, description: 'Unit details.' })
  @ApiResponse({ status: 404, description: 'Unit not found.' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.unitService.findOne(id, req.user.branchId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @RequirePermissions(PERMISSIONS.CREATE_MENU)
  @ApiOperation({
    summary:
      'Create a new unit (Owner/Manager only). If name already exists, returns existing.',
  })
  @ApiResponse({
    status: 201,
    description: 'Unit created or existing returned.',
  })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  async create(@Request() req: any, @Body() dto: CreateUnitDto) {
    return this.unitService.create({
      ...dto,
      branch_id: req.user.branchId,
    });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @RequirePermissions(PERMISSIONS.EDIT_MENU)
  @ApiOperation({ summary: 'Update a unit (Owner/Manager only)' })
  @ApiParam({ name: 'id', description: 'Unit UUID' })
  @ApiResponse({ status: 200, description: 'Unit updated.' })
  @ApiResponse({ status: 404, description: 'Unit not found.' })
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: UpdateUnitDto,
  ) {
    return this.unitService.update(id, req.user.branchId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @RequirePermissions(PERMISSIONS.DELETE_MENU)
  @ApiOperation({ summary: 'Delete a unit (Owner/Manager only)' })
  @ApiParam({ name: 'id', description: 'Unit UUID' })
  @ApiResponse({ status: 200, description: 'Unit deleted.' })
  @ApiResponse({ status: 404, description: 'Unit not found.' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.unitService.remove(id, req.user.branchId);
  }
}
