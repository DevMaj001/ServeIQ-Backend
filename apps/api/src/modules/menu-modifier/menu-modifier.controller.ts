import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { MenuModifierService } from './menu-modifier.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Menu Modifiers')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class MenuModifierController {
  constructor(private readonly modifierService: MenuModifierService) {}

  @Get('modifier-groups')
  @ApiOperation({ summary: 'List all modifier groups for this branch' })
  async findAllGroups(@Request() req: any) {
    return this.modifierService.findAllGroups(req.user.branchId);
  }

  @Get('modifier-groups/:id')
  @ApiOperation({ summary: 'Get modifier group with options' })
  @ApiParam({ name: 'id' })
  async findGroup(@Param('id') id: string, @Request() req: any) {
    const group = await this.modifierService.findGroup(id, req.user.branchId);
    const options = await this.modifierService.findOptions(id);
    return { ...group, options };
  }

  @Post('modifier-groups')
  @ApiOperation({ summary: 'Create a modifier group' })
  async createGroup(@Request() req: any, @Body() body: any) {
    return this.modifierService.createGroup(req.user.branchId, body);
  }

  @Patch('modifier-groups/:id')
  @ApiOperation({ summary: 'Update a modifier group' })
  @ApiParam({ name: 'id' })
  async updateGroup(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.modifierService.updateGroup(id, req.user.branchId, body);
  }

  @Delete('modifier-groups/:id')
  @ApiOperation({ summary: 'Delete a modifier group' })
  @ApiParam({ name: 'id' })
  async removeGroup(@Param('id') id: string, @Request() req: any) {
    return this.modifierService.removeGroup(id, req.user.branchId);
  }

  @Get('modifier-groups/:groupId/options')
  @ApiOperation({ summary: 'List options for a modifier group' })
  @ApiParam({ name: 'groupId' })
  async findOptions(@Param('groupId') groupId: string) {
    return this.modifierService.findOptions(groupId);
  }

  @Post('modifier-groups/:groupId/options')
  @ApiOperation({ summary: 'Add an option to a modifier group' })
  @ApiParam({ name: 'groupId' })
  async createOption(@Param('groupId') groupId: string, @Body() body: any) {
    return this.modifierService.createOption(groupId, body);
  }

  @Patch('modifier-options/:id')
  @ApiOperation({ summary: 'Update a modifier option' })
  @ApiParam({ name: 'id' })
  async updateOption(@Param('id') id: string, @Body() body: any) {
    return this.modifierService.updateOption(id, body);
  }

  @Delete('modifier-options/:id')
  @ApiOperation({ summary: 'Delete a modifier option' })
  @ApiParam({ name: 'id' })
  async removeOption(@Param('id') id: string) {
    return this.modifierService.removeOption(id);
  }

  @Post('menu-items/:menuItemId/modifier-groups')
  @ApiOperation({ summary: 'Link modifier groups to a menu item' })
  @ApiParam({ name: 'menuItemId' })
  async linkGroups(@Param('menuItemId') menuItemId: string, @Request() req: any, @Body() body: { group_ids: string[] }) {
    return this.modifierService.linkGroupsToMenuItem(menuItemId, req.user.branchId, body.group_ids);
  }

  @Get('menu-items/:menuItemId/modifiers')
  @ApiOperation({ summary: 'Get modifier groups with options for a menu item' })
  @ApiParam({ name: 'menuItemId' })
  async getMenuItemModifiers(@Param('menuItemId') menuItemId: string, @Request() req: any) {
    return this.modifierService.getMenuItemModifiers(menuItemId, req.user.branchId);
  }
}