import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from './entities/department.entity';

@Injectable()
export class DepartmentService {
  constructor(
    @InjectRepository(Department)
    private departmentRepo: Repository<Department>,
  ) {}

  async findAll(branchId: string) {
    return this.departmentRepo.find({ where: { branch_id: branchId, is_active: true } });
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
}
