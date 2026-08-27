import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Branch } from '../branch/entities/branch.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Advertisement } from '../advertisement/entities/advertisement.entity';
import { Table } from '../table/entities/table.entity';

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
    @InjectRepository(Table)
    private tableRepo: Repository<Table>,
  ) {}

  @Get('menu/:branchId')
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

  @Get('tables/:branchId/resolve')
  @ApiOperation({
    summary: 'Resolve a table number/label to its UUID within a branch (public)',
  })
  @ApiParam({ name: 'branchId', description: 'Branch UUID' })
  @ApiQuery({ name: 'number', required: true, description: 'Table number or label (e.g. "5", "A1", "Table 5")' })
  @ApiResponse({ status: 200, description: 'Table found.' })
  @ApiResponse({ status: 404, description: 'Table not found.' })
  async resolveTable(
    @Param('branchId') branchId: string,
    @Query('number') number: string,
  ) {
    const branch = await this.branchRepo.findOne({ where: { id: branchId } });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const table = await this.tableRepo.findOne({
      where: [
        { branch_id: branchId, table_number: number },
        { branch_id: branchId, label: number },
      ],
    });

    if (!table) {
      throw new NotFoundException(`Table "${number}" not found at this branch`);
    }

    return {
      tableId: table.id,
      tableNumber: table.table_number,
      label: table.label,
    };
  }
}
