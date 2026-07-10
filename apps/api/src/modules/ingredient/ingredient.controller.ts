import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, Query, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { IngredientService } from './ingredient.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';

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
  async getBestsellers(@Request() req: any, @Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string) {
    return this.ingredientService.getBestsellers(req.user.branchId, dateFrom, dateTo);
  }

  @Get('inventory/alerts')
  @ApiOperation({ summary: 'Get items below reorder level' })
  async getAlerts(@Request() req: any) {
    return this.ingredientService.getAlerts(req.user.branchId);
  }

  @Get('inventory/audit')
  @ApiOperation({ summary: 'Get inventory audit — expected vs actual stock' })
  async getAudit(@Request() req: any) {
    const data = await this.ingredientService.getAudit(req.user.branchId);
    return { success: true, data };
  }

  @Get('inventory/:id')
  @ApiOperation({ summary: 'Get inventory item by ID' })
  @ApiParam({ name: 'id' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.ingredientService.findOne(id, req.user.branchId);
  }

  @Get('inventory/:id/movements')
  @ApiOperation({ summary: 'Get stock movement history for an item' })
  @ApiParam({ name: 'id' })
  async getMovements(@Param('id') id: string, @Request() req: any) {
    return this.ingredientService.getMovements(id, req.user.branchId);
  }

  @Post('inventory')
  @ApiOperation({ summary: 'Create a new inventory item (menu item with stock tracking)' })
  @ApiResponse({ status: 201, description: 'Item created.' })
  async create(@Request() req: any, @Body() body: any) {
    return this.ingredientService.create(req.user.branchId, { ...body, created_by: req.user.userId });
  }

  @Patch('inventory/:id')
  @ApiOperation({ summary: 'Update an inventory item' })
  @ApiParam({ name: 'id' })
  async update(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.ingredientService.update(id, req.user.branchId, body);
  }

  @Delete('inventory/:id')
  @ApiOperation({ summary: 'Delete an inventory item' })
  @ApiParam({ name: 'id' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.ingredientService.remove(id, req.user.branchId);
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
  @ApiOperation({ summary: 'Reconcile inventory — submit physical counts' })
  async reconcile(@Request() req: any, @Body() body: { reconciliation_id: string; counts: { menu_item_id: string; physical_count: number }[] }) {
    const data = await this.ingredientService.reconcile(req.user.branchId, body);
    return { success: true, data };
  }

  @Get('reports/stock-variance')
  @ApiOperation({ summary: 'Stock variance report — expected vs actual' })
  async getStockVariance(@Request() req: any) {
    return this.ingredientService.getStockVariance(req.user.branchId);
  }

  @Get('reports/daily-tally')
  @ApiOperation({ summary: 'Daily stock tally report' })
  @ApiQuery({ name: 'date', required: false })
  async getDailyTally(@Request() req: any, @Query('date') date?: string) {
    const data = await this.ingredientService.getDailyTally(req.user.branchId, date);
    return { success: true, data };
  }

  // Removed endpoints — return 404 to signal consumers to migrate
  @Get('menu-items/:menuItemId/recipe')
  @ApiOperation({ summary: 'Deprecated — recipe system removed' })
  async getRecipe() {
    throw new NotFoundException('Recipe system has been removed. Stock is now tracked directly on menu items.');
  }

  @Post('menu-items/:menuItemId/recipe')
  @ApiOperation({ summary: 'Deprecated — recipe system removed' })
  async addRecipeItem() {
    throw new NotFoundException('Recipe system has been removed. Stock is now tracked directly on menu items.');
  }

  @Patch('menu-items/:menuItemId/recipe')
  @ApiOperation({ summary: 'Deprecated — recipe system removed' })
  async patchRecipe() {
    throw new NotFoundException('Recipe system has been removed. Stock is now tracked directly on menu items.');
  }

  @Delete('menu-items/:menuItemId/recipe')
  @ApiOperation({ summary: 'Deprecated — recipe system removed' })
  async deleteRecipe() {
    throw new NotFoundException('Recipe system has been removed. Stock is now tracked directly on menu items.');
  }

  @Patch('recipe-items/:id')
  @ApiOperation({ summary: 'Deprecated — recipe system removed' })
  async updateRecipeItem() {
    throw new NotFoundException('Recipe system has been removed. Stock is now tracked directly on menu items.');
  }

  @Delete('recipe-items/:id')
  @ApiOperation({ summary: 'Deprecated — recipe system removed' })
  async removeRecipeItem() {
    throw new NotFoundException('Recipe system has been removed. Stock is now tracked directly on menu items.');
  }
}
