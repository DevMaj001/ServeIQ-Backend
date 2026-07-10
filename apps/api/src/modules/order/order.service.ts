import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Order } from './entities/order.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(MenuItem)
    private menuRepository: Repository<MenuItem>,
    @Inject(DataSource)
    private dataSource: DataSource,
  ) {}

  async addOrderItems(tabId: string, items: any[], userId: string) {
    const ids = items.map(i => i.menu_item_id);
    const menuItems = await this.menuRepository.find({ where: { id: In(ids) } });
    const menuMap = new Map(menuItems.map(m => [m.id, m]));

    for (const item of items) {
      const menuItem = menuMap.get(item.menu_item_id);
      if (!menuItem) throw new NotFoundException(`Menu item ${item.menu_item_id} not found`);
      if (menuItem.track_stock && Number(menuItem.quantity_in_stock) < item.quantity) {
        throw new BadRequestException(`Insufficient stock for "${menuItem.name}": ${Number(menuItem.quantity_in_stock)} available, ${item.quantity} requested`);
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const orders = [];
      for (const item of items) {
        const menuItem = menuMap.get(item.menu_item_id);
        if (!menuItem) {
          throw new NotFoundException(`Menu item ${item.menu_item_id} not found`);
        }

        const order = manager.getRepository(Order).create({
          tab_id: tabId,
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
          unit_price_kobo: menuItem.price_kobo,
          subtotal_kobo: item.quantity * menuItem.price_kobo,
          round_number: item.round_number || 1,
          created_by: userId,
          notes: item.notes,
        });
        orders.push(await manager.getRepository(Order).save(order));
      }
      return orders;
    });
  }

  async findByTab(tabId: string) {
    return this.orderRepository.find({
      where: { tab_id: tabId },
    });
  }

  async findOne(id: string) {
    const order = await this.orderRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('Order item not found');
    }
    return order;
  }

  async updateOrder(id: string, updateDto: any) {
    const order = await this.findOne(id);
    
    if (updateDto.quantity !== undefined) {
      order.quantity = updateDto.quantity;
      order.subtotal_kobo = order.quantity * order.unit_price_kobo;
    }
    
    if (updateDto.notes !== undefined) {
      order.notes = updateDto.notes;
    }
    
    return this.orderRepository.save(order);
  }

  async removeOrder(id: string) {
    const order = await this.findOne(id);
    await this.orderRepository.remove(order);
    return { message: 'Order item removed successfully' };
  }
}
