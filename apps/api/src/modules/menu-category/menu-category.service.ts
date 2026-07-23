import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuCategory } from './entities/menu-category.entity';

@Injectable()
export class MenuCategoryService {
  constructor(
    @InjectRepository(MenuCategory)
    private categoryRepo: Repository<MenuCategory>,
  ) {}

  async create(data: Partial<MenuCategory>) {
    const existing = await this.categoryRepo.findOne({
      where: { branch_id: data.branch_id, name: data.name },
    });
    if (existing) return existing;
    const category = this.categoryRepo.create(data);
    return this.categoryRepo.save(category);
  }

  async findAllByBranch(branchId: string) {
    return this.categoryRepo.find({
      where: { branch_id: branchId },
      order: { sort_order: 'ASC', name: 'ASC' },
    });
  }

  async findOne(id: string, branchId: string) {
    const category = await this.categoryRepo.findOne({
      where: { id, branch_id: branchId },
    });
    if (!category) throw new NotFoundException('Menu category not found');
    return category;
  }

  async update(id: string, branchId: string, data: Partial<MenuCategory>) {
    const category = await this.findOne(id, branchId);
    Object.assign(category, data);
    return this.categoryRepo.save(category);
  }

  async remove(id: string, branchId: string) {
    const category = await this.findOne(id, branchId);
    await this.categoryRepo.remove(category);
    return { deleted: true };
  }
}

