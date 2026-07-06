import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
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
  @ApiOperation({ summary: 'List all ingredients with current stock levels' })
  @ApiResponse({ status: 200, description: 'List of ingredients.' })
  async findAll(@Request() req: any) {
    return this.ingredientService.findAll(req.user.branchId);
  }

  @Get('inventory/bestsellers')
  @ApiOperation({ summary: 'Best-selling ingredients with sales data' })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  async getBestsellers(@Request() req: any, @Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string) {
    return this.ingredientService.getBestsellers(req.user.branchId, dateFrom, dateTo);
  }

  @Get('inventory/alerts')
  @ApiOperation({ summary: 'Get ingredients below reorder level' })
  async getAlerts(@Request() req: any) {
    return this.ingredientService.getAlerts(req.user.branchId);
  }

  @Get('inventory/:id')
  @ApiOperation({ summary: 'Get ingredient by ID' })
  @ApiParam({ name: 'id' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.ingredientService.findOne(id, req.user.branchId);
  }

  @Get('inventory/:id/movements')
  @ApiOperation({ summary: 'Get stock movement history for an ingredient' })
  @ApiParam({ name: 'id' })
  async getMovements(@Param('id') id: string, @Request() req: any) {
    return this.ingredientService.getMovements(id, req.user.branchId);
  }

  @Post('inventory')
  @ApiOperation({ summary: 'Create a new ingredient' })
  @ApiResponse({ status: 201, description: 'Ingredient created.' })
  async create(@Request() req: any, @Body() body: any) {
    return this.ingredientService.create(req.user.branchId, body);
  }

  @Patch('inventory/:id')
  @ApiOperation({ summary: 'Update an ingredient' })
  @ApiParam({ name: 'id' })
  async update(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.ingredientService.update(id, req.user.branchId, body);
  }

  @Delete('inventory/:id')
  @ApiOperation({ summary: 'Delete an ingredient' })
  @ApiParam({ name: 'id' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.ingredientService.remove(id, req.user.branchId);
  }

  @Post('inventory/:id/stock')
  @ApiOperation({ summary: 'Add or remove stock from an ingredient' })
  @ApiParam({ name: 'id' })
  async addStock(@Param('id') id: string, @Request() req: any, @Body() body: { quantity: number; notes?: string }) {
    return this.ingredientService.addStock(id, req.user.branchId, body);
  }

  @Get('reports/stock-variance')
  @ApiOperation({ summary: 'Stock variance report — expected vs actual' })
  async getStockVariance(@Request() req: any) {
    return this.ingredientService.getStockVariance(req.user.branchId);
  }

  // Recipe endpoints
  @Get('menu-items/:menuItemId/recipe')
  @ApiOperation({ summary: 'Get all recipe items for a menu item' })
  @ApiParam({ name: 'menuItemId' })
  async getRecipe(@Param('menuItemId') menuItemId: string, @Request() req: any) {
    return this.ingredientService.getRecipe(menuItemId, req.user.branchId);
  }

  @Post('menu-items/:menuItemId/recipe')
  @ApiOperation({ summary: 'Add ingredient to menu item recipe' })
  @ApiParam({ name: 'menuItemId' })
  async addRecipeItem(@Param('menuItemId') menuItemId: string, @Request() req: any, @Body() body: any) {
    return this.ingredientService.addRecipeItem(menuItemId, req.user.branchId, body);
  }

  @Patch('recipe-items/:id')
  @ApiOperation({ summary: 'Update a recipe item' })
  @ApiParam({ name: 'id' })
  async updateRecipeItem(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.ingredientService.updateRecipeItem(id, req.user.branchId, body);
  }

  @Delete('recipe-items/:id')
  @ApiOperation({ summary: 'Remove ingredient from recipe' })
  @ApiParam({ name: 'id' })
  async removeRecipeItem(@Param('id') id: string, @Request() req: any) {
    return this.ingredientService.removeRecipeItem(id, req.user.branchId);
  }
}
