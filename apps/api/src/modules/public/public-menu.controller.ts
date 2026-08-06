import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Branch } from '../branch/entities/branch.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Advertisement } from '../advertisement/entities/advertisement.entity';

@ApiTags('Public')
@Controller('public')
export class PublicMenuController {
  constructor(
    @InjectRepository(Branch)
    private branchRepo: Repository<Branch>,
    @InjectRepository(MenuItem)
    private menuItemRepo: Repository<MenuItem>,
    @InjectRepository(Advertisement)
    private adRepo: Repository<Advertisement>,
  ) {}

  @Get('menu/:branchId')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Get public menu for a branch (no auth required)' })
  @ApiParam({ name: 'branchId', description: 'Branch UUID' })
  @ApiResponse({ status: 200, description: 'Public menu items.' })
  @ApiResponse({ status: 404, description: 'Branch not found.' })
  async getPublicMenu(@Param('branchId') branchId: string) {
    const branch = await this.branchRepo.findOne({
      where: { id: branchId },
      relations: { business: true },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const items = await this.menuItemRepo.find({
      where: { branch_id: branchId, is_available: true },
      order: { category: 'ASC', name: 'ASC' },
    });

    const mapped = items.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      price_kobo: item.price_kobo,
      description: undefined as string | undefined,
      image_url: item.image_url || undefined,
      is_sold_out:
        item.track_stock === true && Number(item.quantity_in_stock) <= 0,
    }));

    return {
      business_name: branch.business.name,
      branch_name: branch.name,
      logo_url: branch.business.logo_url || null,
      brand_primary_color: branch.business.brand_primary_color || null,
      brand_accent_color: branch.business.brand_accent_color || null,
      items: mapped,
    };
  }

  @Get('ads/:branchId')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Get public advertisements for a branch (no auth required)',
  })
  @ApiParam({ name: 'branchId', description: 'Branch UUID' })
  @ApiResponse({ status: 200, description: 'Public advertisements.' })
  @ApiResponse({ status: 404, description: 'Branch not found.' })
  async getPublicAds(@Param('branchId') branchId: string) {
    const branch = await this.branchRepo.findOne({ where: { id: branchId } });
    if (!branch) throw new NotFoundException('Branch not found');

    const ads = await this.adRepo.find({
      where: [
        { branch_id: branchId, is_active: true },
        { branch_id: IsNull(), is_active: true },
      ],
      order: { sort_order: 'ASC', created_at: 'DESC' },
      select: {
        id: true,
        image_url: true,
        link_url: true,
        title: true,
        sort_order: true,
      },
    });

    return ads.map((ad) => ({
      id: ad.id,
      imageUrl: ad.image_url,
      linkUrl: ad.link_url,
      title: ad.title,
      sortOrder: ad.sort_order,
    }));
  }
}
