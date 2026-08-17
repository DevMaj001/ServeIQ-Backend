import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuItem } from './entities/menu-item.entity';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuItem)
    private menuRepository: Repository<MenuItem>,
  ) {}

  async create(createDto: CreateMenuItemDto) {
    const existing = await this.menuRepository.findOne({
      where: { branch_id: createDto.branch_id, name: createDto.name },
    });
    if (existing) return existing;
    const item = this.menuRepository.create(createDto);
    return this.menuRepository.save(item);
  }

  async findAllByBranch(
    branchId: string,
    pagination?: { page: number; per_page: number },
  ) {
    const where = { branch_id: branchId, is_available: true };
    const skip = pagination
      ? (pagination.page - 1) * pagination.per_page
      : undefined;
    const take = pagination ? pagination.per_page : undefined;

    const [data, total] = await this.menuRepository.findAndCount({
      where,
      skip,
      take,
      relations: { supplier: true },
    });
    return { data, total };
  }

  async findOne(id: string, branchId: string) {
    const item = await this.menuRepository.findOne({
      where: { id, branch_id: branchId },
      relations: { supplier: true },
    });
    if (!item) {
      throw new NotFoundException('Menu item not found');
    }
    return item;
  }

  async update(id: string, branchId: string, updateDto: any) {
    const item = await this.findOne(id, branchId);
    Object.assign(item, updateDto);
    return this.menuRepository.save(item);
  }

  async importCsv(branchId: string, userId: string, csvContent: string) {
    const lines = csvContent.split('\n').filter((l) => l.trim());
    if (lines.length < 2)
      throw new BadRequestException(
        'CSV must have a header row and at least one data row',
      );

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const nameIdx = headers.indexOf('name');
    const categoryIdx = headers.indexOf('category');
    const priceIdx = headers.indexOf('price');
    const unitIdx = headers.indexOf('unit');
    const skuIdx = headers.indexOf('sku');

    if (nameIdx === -1 || categoryIdx === -1 || priceIdx === -1) {
      throw new BadRequestException(
        'CSV must have columns: name, category, price',
      );
    }

    const created = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      try {
        const price = parseFloat(cols[priceIdx]);
        if (isNaN(price) || price <= 0) throw new Error('Invalid price');

        const existing = await this.menuRepository.findOne({
          where: { branch_id: branchId, name: cols[nameIdx] },
        });
        if (existing) {
          created.push(existing);
          continue;
        }

        const item = this.menuRepository.create({
          branch_id: branchId,
          created_by: userId,
          name: cols[nameIdx],
          category: cols[categoryIdx],
          price_kobo: Math.round(price * 100),
          unit: unitIdx >= 0 ? cols[unitIdx] : 'unit',
          sku: skuIdx >= 0 ? cols[skuIdx] : undefined,
          is_available: true,
        });
        created.push(await this.menuRepository.save(item));
      } catch (err) {
        errors.push({
          row: i + 1,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { imported: created.length, errors, items: created };
  }

  async toggleAvailability(id: string, branchId: string) {
    const item = await this.findOne(id, branchId);
    item.is_available = !item.is_available;
    return this.menuRepository.save(item);
  }

  async remove(id: string, branchId: string) {
    const item = await this.findOne(id, branchId);
    return this.menuRepository.remove(item);
  }
}
