import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { MenuModifierService } from './menu-modifier.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateModifierGroupDto } from './dto/create-modifier-group.dto';
import { UpdateModifierGroupDto } from './dto/update-modifier-group.dto';
import { CreateModifierOptionDto } from './dto/create-modifier-option.dto';
import { UpdateModifierOptionDto } from './dto/update-modifier-option.dto';

@ApiTags('Menu Modifiers')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class MenuModifierController {
  constructor(private readonly modifierService: MenuModifierService) {}

  @Get('modifier-groups')
  @ApiOperation({ summary: 'List all modifier groups for this branch' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAllGroups(@Request() req: any) {
    return this.modifierService.findAllGroups(req.user.branchId);
  }

  @Get('modifier-groups/:id')
  @ApiOperation({ summary: 'Get modifier group with options' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findGroup(@Param('id') id: string, @Request() req: any) {
    const group = await this.modifierService.findGroup(id, req.user.branchId);
    const options = await this.modifierService.findOptions(id);
    return { ...group, options };
  }

  @Post('modifier-groups')
  @ApiOperation({ summary: 'Create a modifier group' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createGroup(@Request() req: any, @Body() dto: CreateModifierGroupDto) {
    return this.modifierService.createGroup(req.user.branchId, dto);
  }

  @Patch('modifier-groups/:id')
  @ApiOperation({ summary: 'Update a modifier group' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateGroup(@Param('id') id: string, @Request() req: any, @Body() dto: UpdateModifierGroupDto) {
    return this.modifierService.updateGroup(id, req.user.branchId, dto);
  }

  @Delete('modifier-groups/:id')
  @ApiOperation({ summary: 'Delete a modifier group' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async removeGroup(@Param('id') id: string, @Request() req: any) {
    return this.modifierService.removeGroup(id, req.user.branchId);
  }

  @Get('modifier-groups/:groupId/options')
  @ApiOperation({ summary: 'List options for a modifier group' })
  @ApiParam({ name: 'groupId' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findOptions(@Param('groupId') groupId: string) {
    return this.modifierService.findOptions(groupId);
  }

  @Post('modifier-groups/:groupId/options')
  @ApiOperation({ summary: 'Add an option to a modifier group' })
  @ApiParam({ name: 'groupId' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createOption(@Param('groupId') groupId: string, @Body() dto: CreateModifierOptionDto) {
    return this.modifierService.createOption(groupId, dto);
  }

  @Patch('modifier-options/:id')
  @ApiOperation({ summary: 'Update a modifier option' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateOption(@Param('id') id: string, @Body() dto: UpdateModifierOptionDto) {
    return this.modifierService.updateOption(id, dto);
  }

  @Delete('modifier-options/:id')
  @ApiOperation({ summary: 'Delete a modifier option' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async removeOption(@Param('id') id: string) {
    return this.modifierService.removeOption(id);
  }

  @Post('menu-items/:menuItemId/modifier-groups')
  @ApiOperation({ summary: 'Link modifier groups to a menu item' })
  @ApiParam({ name: 'menuItemId' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async linkGroups(@Param('menuItemId') menuItemId: string, @Request() req: any, @Body() body: { group_ids: string[] }) {
    return this.modifierService.linkGroupsToMenuItem(menuItemId, req.user.branchId, body.group_ids);
  }

  @Get('menu-items/:menuItemId/modifiers')
  @ApiOperation({ summary: 'Get modifier groups with options for a menu item' })
  @ApiParam({ name: 'menuItemId' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMenuItemModifiers(@Param('menuItemId') menuItemId: string, @Request() req: any) {
    return this.modifierService.getMenuItemModifiers(menuItemId, req.user.branchId);
  }
}