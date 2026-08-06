import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Unit } from './entities/unit.entity';

@Injectable()
export class UnitService {
  constructor(
    @InjectRepository(Unit)
    private unitRepo: Repository<Unit>,
  ) {}

  async create(data: Partial<Unit>) {
    const existing = await this.unitRepo.findOne({
      where: { branch_id: data.branch_id, name: data.name },
    });
    if (existing) return existing;
    const unit = this.unitRepo.create(data);
    return this.unitRepo.save(unit);
  }

  async findAllByBranch(branchId: string) {
    return this.unitRepo.find({
      where: { branch_id: branchId },
      order: { sort_order: 'ASC', name: 'ASC' },
    });
  }

  async findOne(id: string, branchId: string) {
    const unit = await this.unitRepo.findOne({
      where: { id, branch_id: branchId },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    return unit;
  }

  async update(id: string, branchId: string, data: Partial<Unit>) {
    const unit = await this.findOne(id, branchId);
    Object.assign(unit, data);
    return this.unitRepo.save(unit);
  }

  async remove(id: string, branchId: string) {
    const unit = await this.findOne(id, branchId);
    await this.unitRepo.remove(unit);
    return { deleted: true };
  }
}
