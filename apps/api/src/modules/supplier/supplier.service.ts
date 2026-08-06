import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';

@Injectable()
export class SupplierService {
  constructor(
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
  ) {}

  async findAll(branchId: string) {
    return this.supplierRepository.find({
      where: { branch_id: branchId },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, branchId: string) {
    const supplier = await this.supplierRepository.findOne({
      where: { id, branch_id: branchId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async create(branchId: string, dto: any) {
    const supplier = this.supplierRepository.create({
      ...dto,
      branch_id: branchId,
    });
    return this.supplierRepository.save(supplier);
  }

  async update(id: string, branchId: string, dto: any) {
    const supplier = await this.findOne(id, branchId);
    Object.assign(supplier, dto);
    return this.supplierRepository.save(supplier);
  }

  async remove(id: string, branchId: string) {
    const supplier = await this.findOne(id, branchId);
    return this.supplierRepository.remove(supplier);
  }
}
