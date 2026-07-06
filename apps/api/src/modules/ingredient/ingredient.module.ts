import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngredientController } from './ingredient.controller';
import { IngredientService } from './ingredient.service';
import { Ingredient } from './entities/ingredient.entity';
import { RecipeItem } from './entities/recipe-item.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Order } from '../order/entities/order.entity';
import { Tab } from '../tab/entities/tab.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ingredient, RecipeItem, StockMovement, MenuItem, Order, Tab]),
  ],
  controllers: [IngredientController],
  providers: [IngredientService],
  exports: [IngredientService],
})
export class IngredientModule {}
