import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Department } from './entities/department.entity';

@Injectable()
export class DepartmentService {
  constructor(
    @InjectRepository(Department)
    private departmentRepo: Repository<Department>,
  ) {}

  async findAll(branchId: string, includeInactive = false) {
    const where: FindOptionsWhere<Department> = { branch_id: branchId };
    if (!includeInactive) where.is_active = true;
    return this.departmentRepo.find({ where, order: { name: 'ASC' } });
  }

  async findOne(id: string) {
    const dept = await this.departmentRepo.findOne({ where: { id } });
    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  async create(branchId: string, name: string) {
    const dept = this.departmentRepo.create({ branch_id: branchId, name });
    return this.departmentRepo.save(dept);
  }

  async update(id: string, data: { name?: string; is_active?: boolean }) {
    const dept = await this.findOne(id);
    if (data.name !== undefined) dept.name = data.name;
    if (data.is_active !== undefined) dept.is_active = data.is_active;
    return this.departmentRepo.save(dept);
  }

  async remove(id: string) {
    const dept = await this.findOne(id);
    return this.departmentRepo.remove(dept);
  }
}
