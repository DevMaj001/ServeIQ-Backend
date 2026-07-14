import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Branch } from '../branch/entities/branch.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';

@ApiTags('Public')
@Controller('public')
export class PublicMenuController {
  constructor(
    @InjectRepository(Branch)
    private branchRepo: Repository<Branch>,
    @InjectRepository(MenuItem)
    private menuItemRepo: Repository<MenuItem>,
  ) {}

  @Get('menu/:branchId')
  @ApiOperation({ summary: 'Get public menu for a branch (no auth required)' })
  @ApiResponse({ status: 200, description: 'Public menu items.' })
  @ApiResponse({ status: 404, description: 'Branch not found.' })
  async getPublicMenu(@Param('branchId') branchId: string) {
    const branch = await this.branchRepo.findOne({
      where: { id: branchId },
      relations: ['business'],
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const items = await this.menuItemRepo.find({
      where: { branch_id: branchId, is_available: true },
      order: { category: 'ASC', name: 'ASC' },
    });

    const mapped = items.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      price_kobo: item.price_kobo,
      description: undefined as string | undefined,
      image_url: item.image_url || undefined,
      is_sold_out: item.track_stock === true && Number(item.quantity_in_stock) <= 0,
    }));

    return {
      success: true,
      data: {
        business_name: branch.business.name,
        branch_name: branch.name,
        logo_url: branch.business.logo_url || null,
        items: mapped,
      },
    };
  }
}
