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
import { SupplierService } from './supplier.service';
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
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@ApiTags('Suppliers')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('suppliers')
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.MANAGE_SUPPLIERS)
  @ApiOperation({ summary: 'List all suppliers for the branch' })
  @ApiResponse({
    status: 200,
    description: 'Supplier retrieved/created/updated/deleted',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Request() req: any) {
    return this.supplierService.findAll(req.user.branchId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.MANAGE_SUPPLIERS)
  @ApiOperation({ summary: 'Get a supplier by ID' })
  @ApiParam({ name: 'id' })
  @ApiResponse({
    status: 200,
    description: 'Supplier retrieved/created/updated/deleted',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.supplierService.findOne(id, req.user.branchId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.MANAGE_SUPPLIERS)
  @ApiOperation({ summary: 'Create a supplier (Owner/Manager only)' })
  @ApiResponse({
    status: 200,
    description: 'Supplier retrieved/created/updated/deleted',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Request() req: any, @Body() dto: CreateSupplierDto) {
    return this.supplierService.create(req.user.branchId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.MANAGE_SUPPLIERS)
  @ApiOperation({ summary: 'Update a supplier (Owner/Manager only)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({
    status: 200,
    description: 'Supplier retrieved/created/updated/deleted',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.supplierService.update(id, req.user.branchId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.MANAGE_SUPPLIERS)
  @ApiOperation({ summary: 'Delete a supplier (Owner/Manager only)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({
    status: 200,
    description: 'Supplier retrieved/created/updated/deleted',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.supplierService.remove(id, req.user.branchId);
  }
}
