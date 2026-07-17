import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Advertisement } from './entities/advertisement.entity';

@Injectable()
export class AdvertisementService {
  constructor(
    @InjectRepository(Advertisement)
    private adRepo: Repository<Advertisement>,
  ) {}

  async findAll(branchId: string) {
    return this.adRepo.find({
      where: { branch_id: branchId },
      order: { sort_order: 'ASC', created_at: 'DESC' },
    });
  }

  async findPublic(branchId: string) {
    return this.adRepo.find({
      where: { branch_id: branchId, is_active: true },
      order: { sort_order: 'ASC', created_at: 'DESC' },
      select: { id: true, image_url: true, link_url: true, title: true, sort_order: true },
    });
  }

  async findOne(id: string, branchId: string) {
    const ad = await this.adRepo.findOne({ where: { id, branch_id: branchId } });
    if (!ad) throw new NotFoundException('Advertisement not found');
    return ad;
  }

  async create(branchId: string, data: Partial<Advertisement>) {
    const ad = this.adRepo.create({ ...data, branch_id: branchId });
    return this.adRepo.save(ad);
  }

  async update(id: string, branchId: string, data: Partial<Advertisement>) {
    const ad = await this.findOne(id, branchId);
    Object.assign(ad, data);
    return this.adRepo.save(ad);
  }

  async remove(id: string, branchId: string) {
    const ad = await this.findOne(id, branchId);
    await this.adRepo.remove(ad);
    return { deleted: true };
  }
}
