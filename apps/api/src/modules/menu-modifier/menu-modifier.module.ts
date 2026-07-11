import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuModifierService } from './menu-modifier.service';
import { MenuModifierController } from './menu-modifier.controller';
import { ModifierGroup } from './modifier-group.entity';
import { ModifierOption } from './modifier-option.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ModifierGroup, ModifierOption, MenuItem])],
  providers: [MenuModifierService],
  controllers: [MenuModifierController],
  exports: [MenuModifierService],
})
export class MenuModifierModule {}