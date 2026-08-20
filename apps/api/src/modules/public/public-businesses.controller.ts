import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Business } from '../business/entities/business.entity';

@ApiTags('Public')
@Controller('public')
export class PublicBusinessesController {
  constructor(
    @InjectRepository(Business)
    private businessRepo: Repository<Business>,
  ) {}

  @Get('businesses')
  @ApiOperation({ summary: 'List active registered businesses (no auth required)' })
  @ApiResponse({ status: 200, description: 'Active registered businesses.' })
  async getPublicBusinesses() {
    const businesses = await this.businessRepo.find({
      where: { is_active: true },
      relations: { branches: true },
      order: { created_at: 'ASC' },
      take: 20,
    });

    return businesses.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      type: b.type,
      address: b.address || null,
      logo_url: b.logo_url || null,
      brand_primary_color: b.brand_primary_color || null,
      brand_accent_color: b.brand_accent_color || null,
      branch_count: b.branches.length,
      created_at: b.created_at,
    }));
  }
}