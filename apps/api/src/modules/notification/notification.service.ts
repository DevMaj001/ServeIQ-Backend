import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
  ) {}

  /**
   * Notifications visible to a caller: branch broadcasts (user_id IS NULL)
   * plus anything targeted at them personally. Waiters therefore only ever
   * see their own notifications, never other staff's.
   */
  private visibleWhere(branchId: string, userId: string) {
    return `notification.branch_id = :branchId AND (notification.user_id = :userId OR notification.user_id IS NULL)`;
  }

  async findAll(branchId: string, userId: string, unreadOnly = false) {
    const qb = this.notificationRepository
      .createQueryBuilder('notification')
      .where(this.visibleWhere(branchId, userId), { branchId, userId })
      .orderBy('notification.created_at', 'DESC');
    if (unreadOnly) qb.andWhere('notification.is_read = false');
    return qb.getMany();
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

  async markAsRead(ids: string[], branchId: string, userId: string) {
    await this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ is_read: true })
      .where(
        `branch_id = :branchId AND (user_id = :userId OR user_id IS NULL) AND id IN (:...ids)`,
        { branchId, userId, ids },
      )
      .execute();
    return { success: true };
  }

  async markAllAsRead(branchId: string, userId: string) {
    await this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ is_read: true })
      .where(
        `branch_id = :branchId AND (user_id = :userId OR user_id IS NULL)`,
        { branchId, userId },
      )
      .execute();
    return { success: true };
  }

  async delete(id: string, branchId: string) {
    const notification = await this.findOne(id, branchId);
    await this.notificationRepository.remove(notification);
    return { success: true };
  }

  async getUnreadCount(branchId: string, userId: string) {
    return this.notificationRepository
      .createQueryBuilder('notification')
      .where(this.visibleWhere(branchId, userId), { branchId, userId })
      .andWhere('notification.is_read = false')
      .getCount();
  }
}
