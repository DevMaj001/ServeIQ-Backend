import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublicMenuController } from './public-menu.controller';
import { Branch } from '../branch/entities/branch.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Advertisement } from '../advertisement/entities/advertisement.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Branch, MenuItem, Advertisement]),
  ],
  controllers: [PublicMenuController],
})
export class PublicModule {}
