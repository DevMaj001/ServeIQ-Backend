import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  Request,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MenuService } from './menu.service';
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
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { MenuItem } from './entities/menu-item.entity';
import { getPaginationParams, paginate } from '../../common/pagination';

interface RequestWithUser {
  user: {
    branchId: string;
    userId: string;
  };
}

@ApiTags('Menu')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller(['menu-items', 'menu'])
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  @ApiOperation({ summary: 'Get all available menu items for the branch' })
  @ApiQuery({ name: 'page', required: false, example: '1' })
  @ApiQuery({ name: 'per_page', required: false, example: '50' })
  @ApiResponse({
    status: 200,
    description: 'List of menu items.',
    type: [MenuItem],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findAll(
    @Request() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('per_page') per_page?: string,
  ) {
    const pagination = getPaginationParams({ page, per_page });
    const { data, total } = await this.menuService.findAllByBranch(
      req.user.branchId,
      pagination,
    );
    return paginate(data, total, pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a menu item by ID' })
  @ApiParam({ name: 'id', description: 'Menu item UUID' })
  @ApiResponse({
    status: 200,
    description: 'Menu item details.',
    type: MenuItem,
  })
  @ApiResponse({ status: 404, description: 'Menu item not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findOne(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.menuService.findOne(id, req.user.branchId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a new menu item (Owner/Manager only)' })
  @ApiResponse({
    status: 201,
    description: 'Menu item created.',
    type: MenuItem,
  })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async create(
    @Request() req: RequestWithUser,
    @Body() createDto: CreateMenuItemDto,
  ) {
    const data = { ...createDto };
    if (data.price && !data.price_kobo) {
      data.price_kobo = Math.round(data.price * 100);
    }
    return this.menuService.create({
      ...data,
      branch_id: req.user.branchId,
      created_by: req.user.userId,
    });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update a menu item (Owner/Manager only)' })
  @ApiParam({ name: 'id', description: 'Menu item UUID' })
  @ApiResponse({ status: 200, description: 'Menu item updated.' })
  @ApiResponse({ status: 404, description: 'Menu item not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async update(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
    @Body() updateDto: UpdateMenuItemDto,
  ) {
    const data = { ...updateDto };
    if (data.price && !data.price_kobo) {
      data.price_kobo = Math.round(data.price * 100);
    }
    return this.menuService.update(id, req.user.branchId, data);
  }

  @Post('import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024, files: 1 },
      fileFilter: (
        req: any,
        file: Express.Multer.File,
        cb: (error: Error | null, acceptFile: boolean) => void,
      ) => {
        if (
          file.mimetype !== 'text/csv' &&
          !file.originalname.endsWith('.csv')
        ) {
          cb(new BadRequestException('Only CSV files are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Bulk import menu items from CSV (columns: name, category, price, unit, sku)',
  })
  @ApiResponse({ status: 201, description: 'Items imported.' })
  async importCsv(
    @Request() req: RequestWithUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('CSV file required');
    return this.menuService.importCsv(
      req.user.branchId,
      req.user.userId,
      file.buffer.toString(),
    );
  }

  @Patch(':id/toggle')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.MARK_UNAVAILABLE)
  @ApiOperation({ summary: 'Toggle menu item availability (on/off)' })
  @ApiParam({ name: 'id', description: 'Menu item UUID' })
  @ApiResponse({ status: 200, description: 'Menu item availability toggled.' })
  @ApiResponse({ status: 404, description: 'Menu item not found.' })
  async toggleAvailability(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.menuService.toggleAvailability(id, req.user.branchId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete a menu item (Owner/Manager only)' })
  @ApiParam({ name: 'id', description: 'Menu item UUID' })
  @ApiResponse({ status: 200, description: 'Menu item deleted.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.menuService.remove(id, req.user.branchId);
  }
}
