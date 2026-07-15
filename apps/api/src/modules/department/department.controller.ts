import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/shared';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Departments')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.SUPERVISOR)
  @ApiOperation({ summary: 'List active departments for the branch' })
  async findAll(@Request() req: any) {
    return this.departmentService.findAll(req.user.branchId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a new department' })
  async create(@Request() req: any, @Body('name') name: string) {
    return this.departmentService.create(req.user.branchId, name);
  }
}
