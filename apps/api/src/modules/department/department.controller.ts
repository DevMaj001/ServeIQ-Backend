import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/shared';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('Departments')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERVISOR)
  @ApiOperation({ summary: 'List departments for the branch' })
  @ApiQuery({ name: 'include_inactive', required: false, type: Boolean })
  async findAll(@Request() req: any, @Query('include_inactive') includeInactive?: string) {
    return this.departmentService.findAll(req.user.branchId, includeInactive === 'true');
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a new department' })
  async create(@Request() req: any, @Body('name') name: string) {
    return this.departmentService.create(req.user.branchId, name);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update a department' })
  async update(@Param('id') id: string, @Body() data: { name?: string; is_active?: boolean }) {
    return this.departmentService.update(id, data);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete a department' })
  async remove(@Param('id') id: string) {
    return this.departmentService.remove(id);
  }
}
