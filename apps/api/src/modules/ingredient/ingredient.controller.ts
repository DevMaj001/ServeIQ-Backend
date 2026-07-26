import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, Query, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { IngredientService } from './ingredient.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/shared';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';

@ApiTags('Inventory')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class IngredientController {
  constructor(private readonly ingredientService: IngredientService) {}

  @Get('inventory')
  @ApiOperation({ summary: 'List all inventory items with current stock levels' })
  @ApiResponse({ status: 200, description: 'List of inventory items.' })
  async findAll(@Request() req: any) {
    return this.ingredientService.findAll(req.user.branchId);
  }

  @Get('inventory/bestsellers')
  @ApiOperation({ summary: 'Best-selling items with sales data' })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getBestsellers(@Request() req: any, @Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string) {
    return this.ingredientService.getBestsellers(req.user.branchId, dateFrom, dateTo);
  }

  @Get('inventory/alerts')
  @ApiOperation({ summary: 'Get items below reorder level' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAlerts(@Request() req: any) {
    return this.ingredientService.getAlerts(req.user.branchId);
  }

  @Get('inventory/untracked-items')
  @ApiOperation({ summary: 'Get menu items that are not tracked for stock' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUntracked(@Request() req: any) {
    return this.ingredientService.findUntracked(req.user.branchId);
  }

  @Get('inventory/audit')
  @ApiOperation({ summary: 'Get inventory audit — expected vs actual stock' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAudit(@Request() req: any) {
    const data = await this.ingredientService.getAudit(req.user.branchId);
    return { success: true, data };
  }

  @Get('inventory/:id')
  @ApiOperation({ summary: 'Get inventory item by ID' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.ingredientService.findOne(id, req.user.branchId);
  }

  @Get('inventory/:id/movements')
  @ApiOperation({ summary: 'Get stock movement history for an item' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMovements(@Param('id') id: string, @Request() req: any) {
    return this.ingredientService.getMovements(id, req.user.branchId);
  }

  @Post('inventory')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create inventory item (Owner/Manager only)' })
  @ApiResponse({ status: 201, description: 'Item created.' })
  async create(@Request() req: any, @Body() dto: CreateInventoryItemDto) {
    return this.ingredientService.create(req.user.branchId, { ...dto, created_by: req.user.userId });
  }

  @Patch('inventory/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update inventory item (Owner/Manager only)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(@Param('id') id: string, @Request() req: any, @Body() dto: UpdateInventoryItemDto) {
    return this.ingredientService.update(id, req.user.branchId, body);
  }

  @Delete('inventory/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete inventory item (Owner/Manager only)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.ingredientService.remove(id, req.user.branchId);
  }

  @Get('menu-items/:id/movements')
  @ApiOperation({ summary: 'Get stock movement history for a menu item' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMenuItemMovements(@Param('id') id: string, @Request() req: any) {
    return this.ingredientService.getMovements(id, req.user.branchId);
  }

  @Post('menu-items/:id/restock')
  @ApiOperation({ summary: 'Restock a menu item' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Restock successful.' })
  @ApiResponse({ status: 422, description: 'Validation error.' })
  async restock(@Param('id') id: string, @Request() req: any, @Body() body: { added_quantity: number; cost_price_kobo?: number; barcode?: string }) {
    try {
      const data = await this.ingredientService.restock(id, req.user.branchId, body);
      return { success: true, data };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        { success: false, message: err.message, errors: {} },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  @Post('inventory/reconcile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Reconcile inventory (Owner/Manager only)' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async reconcile(@Request() req: any, @Body() body: { reconciliation_id: string; counts: { menu_item_id: string; physical_count: number }[] }) {
    const data = await this.ingredientService.reconcile(req.user.branchId, body);
    return { success: true, data };
  }

  @Get('reports/stock-variance')
  @ApiOperation({ summary: 'Stock variance report — expected vs actual' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStockVariance(@Request() req: any) {
    return this.ingredientService.getStockVariance(req.user.branchId);
  }

  @Get('reports/daily-tally')
  @ApiOperation({ summary: 'Daily stock tally report' })
  @ApiQuery({ name: 'date', required: false })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getDailyTally(@Request() req: any, @Query('date') date?: string) {
    const data = await this.ingredientService.getDailyTally(req.user.branchId, date);
    return { success: true, data };
  }

  // Removed endpoints — return 404 to signal consumers to migrate
  @Get('menu-items/:menuItemId/recipe')
  @ApiOperation({ summary: 'Deprecated — recipe system removed' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getRecipe() {
    throw new NotFoundException('Recipe system has been removed. Stock is now tracked directly on menu items.');
  }

  @Post('menu-items/:menuItemId/recipe')
  @ApiOperation({ summary: 'Deprecated — recipe system removed' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async addRecipeItem() {
    throw new NotFoundException('Recipe system has been removed. Stock is now tracked directly on menu items.');
  }

  @Patch('menu-items/:menuItemId/recipe')
  @ApiOperation({ summary: 'Deprecated — recipe system removed' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async patchRecipe() {
    throw new NotFoundException('Recipe system has been removed. Stock is now tracked directly on menu items.');
  }

  @Delete('menu-items/:menuItemId/recipe')
  @ApiOperation({ summary: 'Deprecated — recipe system removed' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteRecipe() {
    throw new NotFoundException('Recipe system has been removed. Stock is now tracked directly on menu items.');
  }

  @Patch('recipe-items/:id')
  @ApiOperation({ summary: 'Deprecated — recipe system removed' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateRecipeItem() {
    throw new NotFoundException('Recipe system has been removed. Stock is now tracked directly on menu items.');
  }

  @Delete('recipe-items/:id')
  @ApiOperation({ summary: 'Deprecated — recipe system removed' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async removeRecipeItem() {
    throw new NotFoundException('Recipe system has been removed. Stock is now tracked directly on menu items.');
  }
}
