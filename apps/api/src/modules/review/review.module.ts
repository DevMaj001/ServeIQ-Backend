import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from './entities/review.entity';
import { ReviewService } from './review.service';
import { AdminReviewController } from './review-admin.controller';
import { Branch } from '../branch/entities/branch.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Order } from '../order/entities/order.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review, Branch, Tab, Order, MenuItem]),
  ],
  providers: [ReviewService],
  controllers: [AdminReviewController],
  exports: [ReviewService, TypeOrmModule],
})
export class ReviewModule {}
