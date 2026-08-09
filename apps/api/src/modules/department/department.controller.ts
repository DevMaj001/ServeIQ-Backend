import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DepartmentService } from './department.service';
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
  ApiQuery,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';

interface RequestWithUser {
  user: {
    branchId: string;
  };
}

@ApiTags('Departments')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get()
  @Roles(
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.SUPERVISOR,
    UserRole.WAITER,
    UserRole.CHEF,
    UserRole.CASHIER,
  )
  @ApiOperation({
    summary: 'List departments (Owner/Manager/Supervisor/Waiter/Chef/Cashier)',
  })
  @ApiQuery({ name: 'include_inactive', required: false, type: Boolean })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  async findAll(
    @Request() req: RequestWithUser,
    @Query('include_inactive') includeInactive?: string,
  ) {
    return this.departmentService.findAll(
      req.user.branchId,
      includeInactive === 'true',
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.EDIT_STAFF)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a new department' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  async create(@Request() req: RequestWithUser, @Body() dto: CreateDepartmentDto) {
    return this.departmentService.create(req.user.branchId, dto.name);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.EDIT_STAFF)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update a department' })
  @ApiParam({ name: 'id', description: 'Department UUID' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.EDIT_STAFF)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete a department' })
  @ApiParam({ name: 'id', description: 'Department UUID' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  async remove(@Param('id') id: string) {
    return this.departmentService.remove(id);
  }
}
