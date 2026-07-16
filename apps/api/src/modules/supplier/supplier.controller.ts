import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { SupplierService } from './supplier.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/shared';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@ApiTags('Suppliers')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('suppliers')
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Get()
  @ApiOperation({ summary: 'List all suppliers for the branch' })
  async findAll(@Request() req: any) {
    return this.supplierService.findAll(req.user.branchId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a supplier by ID' })
  @ApiParam({ name: 'id' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.supplierService.findOne(id, req.user.branchId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a supplier (Owner/Manager only)' })
  async create(@Request() req: any, @Body() dto: CreateSupplierDto) {
    return this.supplierService.create(req.user.branchId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update a supplier (Owner/Manager only)' })
  @ApiParam({ name: 'id' })
  async update(@Param('id') id: string, @Request() req: any, @Body() dto: UpdateSupplierDto) {
    return this.supplierService.update(id, req.user.branchId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete a supplier (Owner/Manager only)' })
  @ApiParam({ name: 'id' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.supplierService.remove(id, req.user.branchId);
  }
}
