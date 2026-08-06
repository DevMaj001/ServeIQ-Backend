import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, FindOptionsWhere } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
  ) {}

  async findAll(branchId: string, unreadOnly = false) {
    const where: FindOptionsWhere<Notification> = {
      branch_id: branchId,
    };
    if (unreadOnly) where.is_read = false;
    return this.notificationRepository.find({
      where,
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, branchId: string) {
    const notification = await this.notificationRepository.findOne({
      where: { id, branch_id: branchId },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    return notification;
  }

  async create(dto: CreateNotificationDto) {
    const notification = this.notificationRepository.create(dto);
    return this.notificationRepository.save(notification);
  }

  async markAsRead(ids: string[], branchId: string) {
    await this.notificationRepository.update(
      { id: In(ids), branch_id: branchId },
      { is_read: true },
    );
    return { success: true };
  }

  async markAllAsRead(branchId: string) {
    await this.notificationRepository.update(
      { branch_id: branchId, is_read: false },
      { is_read: true },
    );
    return { success: true };
  }

  async delete(id: string, branchId: string) {
    const notification = await this.findOne(id, branchId);
    await this.notificationRepository.remove(notification);
    return { success: true };
  }

  async getUnreadCount(branchId: string) {
    return this.notificationRepository.count({
      where: { branch_id: branchId, is_read: false },
    });
  }
}
