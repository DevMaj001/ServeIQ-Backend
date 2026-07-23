import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/shared';
import { MenuCategoryService } from './menu-category.service';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';

@ApiTags('Menu Categories')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.MANAGER)
@Controller('menu-categories')
export class MenuCategoryController {
  constructor(private readonly categoryService: MenuCategoryService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER, UserRole.CHEF, UserRole.CASHIER, UserRole.SUPERVISOR)
  @ApiOperation({ summary: 'Get all menu categories for the branch' })
  @ApiResponse({ status: 200, description: 'List of menu categories.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findAll(@Request() req: any) {
    return this.categoryService.findAllByBranch(req.user.branchId);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER, UserRole.CHEF, UserRole.CASHIER, UserRole.SUPERVISOR)
  @ApiOperation({ summary: 'Get a menu category by ID' })
  @ApiParam({ name: 'id', description: 'Menu category UUID' })
  @ApiResponse({ status: 200, description: 'Menu category details.' })
  @ApiResponse({ status: 404, description: 'Menu category not found.' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.categoryService.findOne(id, req.user.branchId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new menu category (Owner/Manager only)' })
  @ApiResponse({ status: 201, description: 'Menu category created.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  async create(@Request() req: any, @Body() dto: CreateMenuCategoryDto) {
    return this.categoryService.create({
      ...dto,
      branch_id: req.user.branchId,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a menu category (Owner/Manager only)' })
  @ApiParam({ name: 'id', description: 'Menu category UUID' })
  @ApiResponse({ status: 200, description: 'Menu category updated.' })
  @ApiResponse({ status: 404, description: 'Menu category not found.' })
  async update(@Param('id') id: string, @Request() req: any, @Body() dto: UpdateMenuCategoryDto) {
    return this.categoryService.update(id, req.user.branchId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a menu category (Owner/Manager only)' })
  @ApiParam({ name: 'id', description: 'Menu category UUID' })
  @ApiResponse({ status: 200, description: 'Menu category deleted.' })
  @ApiResponse({ status: 404, description: 'Menu category not found.' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.categoryService.remove(id, req.user.branchId);
  }
}

