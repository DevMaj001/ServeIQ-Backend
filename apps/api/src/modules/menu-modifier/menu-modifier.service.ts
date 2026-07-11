import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModifierGroup } from './modifier-group.entity';
import { ModifierOption } from './modifier-option.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';

@Injectable()
export class MenuModifierService {
  constructor(
    @InjectRepository(ModifierGroup)
    private groupRepo: Repository<ModifierGroup>,
    @InjectRepository(ModifierOption)
    private optionRepo: Repository<ModifierOption>,
    @InjectRepository(MenuItem)
    private menuItemRepo: Repository<MenuItem>,
  ) {}

  // ── Groups ──

  async findAllGroups(branchId: string) {
    return this.groupRepo.find({
      where: { branch_id: branchId },
      relations: { menu_items: true },
      order: { sort_order: 'ASC', name: 'ASC' },
    });
  }

  async findGroup(id: string, branchId: string) {
    const group = await this.groupRepo.findOne({
      where: { id, branch_id: branchId },
      relations: { menu_items: true },
    });
    if (!group) throw new NotFoundException('Modifier group not found');
    return group;
  }

  async createGroup(branchId: string, data: any) {
    return this.groupRepo.save(this.groupRepo.create({ ...data, branch_id: branchId }));
  }

  async updateGroup(id: string, branchId: string, data: any) {
    const group = await this.findGroup(id, branchId);
    Object.assign(group, data);
    return this.groupRepo.save(group);
  }

  async removeGroup(id: string, branchId: string) {
    const group = await this.findGroup(id, branchId);
    return this.groupRepo.remove(group);
  }

  // ── Options ──

  async findOptions(groupId: string) {
    return this.optionRepo.find({
      where: { modifier_group_id: groupId },
      order: { sort_order: 'ASC', name: 'ASC' },
    });
  }

  async createOption(groupId: string, data: any) {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Modifier group not found');
    return this.optionRepo.save(this.optionRepo.create({ ...data, modifier_group_id: groupId }));
  }

  async updateOption(id: string, data: any) {
    const option = await this.optionRepo.findOne({ where: { id } });
    if (!option) throw new NotFoundException('Modifier option not found');
    Object.assign(option, data);
    return this.optionRepo.save(option);
  }

  async removeOption(id: string) {
    const option = await this.optionRepo.findOne({ where: { id } });
    if (!option) throw new NotFoundException('Modifier option not found');
    return this.optionRepo.remove(option);
  }

  // ── Menu Item Linking ──

  async linkGroupsToMenuItem(menuItemId: string, branchId: string, groupIds: string[]) {
    const menuItem = await this.menuItemRepo.findOne({
      where: { id: menuItemId, branch_id: branchId },
      relations: { modifierGroups: true },
    });
    if (!menuItem) throw new NotFoundException('Menu item not found');

    const groups = await this.groupRepo.findBy({ id: groupIds as any });
    menuItem.modifierGroups = groups;
    return this.menuItemRepo.save(menuItem);
  }

  async getMenuItemModifiers(menuItemId: string, branchId: string) {
    const menuItem = await this.menuItemRepo.findOne({
      where: { id: menuItemId, branch_id: branchId },
      relations: { modifierGroups: { menu_items: false } },
    });
    if (!menuItem) throw new NotFoundException('Menu item not found');

    const groupIds = (menuItem.modifierGroups || []).map(g => g.id);
    if (groupIds.length === 0) return [];

    const options = await this.optionRepo.find({
      where: groupIds.map(id => ({ modifier_group_id: id })),
      order: { sort_order: 'ASC', name: 'ASC' },
    });

    return (menuItem.modifierGroups || []).map(group => ({
      ...group,
      menu_items: undefined,
      options: options.filter(o => o.modifier_group_id === group.id),
    }));
  }
}