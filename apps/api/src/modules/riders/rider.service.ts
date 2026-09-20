import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Rider } from './entities/rider.entity';
import { User } from '../user/entities/user.entity';
import { Role } from '../role/entities/role.entity';
import { Permission } from '../role/entities/permission.entity';
import { Branch } from '../branch/entities/branch.entity';
import { UserRole } from '../../common/shared';
import { PERMISSIONS } from '../role/permission-codes';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/entities/notification.entity';

export interface RiderUserView {
  id: string;
  user_id: string;
  branch_id: string;
  business_id: string;
  is_online: boolean;
  vehicle: string | null;
  avatar_url: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: Date;
}

@Injectable()
export class RiderService {
  constructor(
    @InjectRepository(Rider)
    private riderRepo: Repository<Rider>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepo: Repository<Permission>,
    @InjectRepository(Branch)
    private branchRepo: Repository<Branch>,
    private notificationService: NotificationService,
  ) {}

  private async resolveRiderRole(): Promise<Role> {
    let role = await this.roleRepo.findOne({ where: { name: 'Rider' } });
    if (!role) {
      const codes = [
        PERMISSIONS.ACCEPT_DELIVERY,
        PERMISSIONS.COMPLETE_DELIVERY,
        PERMISSIONS.VIEW_DELIVERIES,
        PERMISSIONS.VIEW_TRACKING,
      ];
      const permissions = await this.permissionRepo.find({
        where: codes.map((code) => ({ code })),
      });
      role = this.roleRepo.create({
        name: 'Rider',
        description: 'Delivers dispatch takeaway orders',
        is_system: true,
        permissions,
      });
      role = await this.roleRepo.save(role);
    }
    return role;
  }

  async create(
    dto: {
      full_name: string;
      email: string;
      password: string;
      phone?: string;
      vehicle?: string;
      branch_id: string;
    },
    caller: { businessId: string; branchId: string },
  ) {
    const branch = await this.branchRepo.findOne({
      where: { id: dto.branch_id, business_id: caller.businessId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const existing = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) throw new ConflictException('Email already exists');

    const role = await this.resolveRiderRole();
    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const user = this.userRepo.create({
      business_id: caller.businessId,
      branch_id: dto.branch_id,
      full_name: dto.full_name,
      email: dto.email.toLowerCase(),
      phone: dto.phone ?? '',
      password_hash: passwordHash,
      role: UserRole.RIDER,
      role_id: role.id,
      is_active: true,
    });
    const savedUser = await this.userRepo.save(user);

    const rider = this.riderRepo.create({
      user_id: savedUser.id,
      business_id: caller.businessId,
      branch_id: dto.branch_id,
      is_online: false,
      vehicle: dto.vehicle ?? null,
    });
    const savedRider = await this.riderRepo.save(rider);

    return this.toView(savedRider, savedUser);
  }

  async findAll(businessId: string, branchId?: string) {
    const riders = await this.riderRepo.find({
      where: branchId
        ? { business_id: businessId, branch_id: branchId }
        : { business_id: businessId },
      order: { created_at: 'DESC' },
    });
    const userIds = riders.map((r) => r.user_id);
    const users = userIds.length
      ? await this.userRepo.find({ where: userIds.map((id) => ({ id })) })
      : [];
    const userById = new Map(users.map((u) => [u.id, u]));
    return riders.map((r) => this.toView(r, userById.get(r.user_id) ?? null));
  }

  async update(
    id: string,
    businessId: string,
    dto: {
      branch_id?: string;
      is_online?: boolean;
      vehicle?: string;
      is_active?: boolean;
    },
  ) {
    const rider = await this.riderRepo.findOne({
      where: { id, business_id: businessId },
    });
    if (!rider) throw new NotFoundException('Rider not found');

    if (dto.branch_id !== undefined && dto.branch_id !== rider.branch_id) {
      const branch = await this.branchRepo.findOne({
        where: { id: dto.branch_id, business_id: businessId },
      });
      if (!branch) throw new NotFoundException('Branch not found');
      rider.branch_id = dto.branch_id;
    }
    if (dto.is_online !== undefined) rider.is_online = dto.is_online;
    if (dto.vehicle !== undefined) rider.vehicle = dto.vehicle ?? null;
    await this.riderRepo.save(rider);

    if (dto.is_active !== undefined) {
      await this.userRepo.update(rider.user_id, { is_active: dto.is_active });
    }

    const user = await this.userRepo.findOne({ where: { id: rider.user_id } });
    return this.toView(rider, user);
  }

  async toggleOnline(userId: string) {
    const rider = await this.riderRepo.findOne({ where: { user_id: userId } });
    if (!rider) throw new NotFoundException('Rider profile not found');
    rider.is_online = !rider.is_online;
    await this.riderRepo.save(rider);
    return { rider_id: rider.id, is_online: rider.is_online };
  }

  async remove(id: string, businessId: string) {
    const rider = await this.riderRepo.findOne({
      where: { id, business_id: businessId },
    });
    if (!rider) throw new NotFoundException('Rider not found');
    await this.userRepo.update(rider.user_id, { is_active: false });
    await this.riderRepo.delete(rider.id);
    return { success: true };
  }

  async findByUserId(userId: string): Promise<Rider> {
    const rider = await this.riderRepo.findOne({ where: { user_id: userId } });
    if (!rider) throw new NotFoundException('Rider profile not found');
    return rider;
  }

  async onlineRidersForBranch(branchId: string): Promise<Rider[]> {
    return this.riderRepo.find({
      where: { branch_id: branchId, is_online: true },
    });
  }

  async notifyOnlineRiders(
    branchId: string,
    payload: {
      type: NotificationType;
      title: string;
      message: string;
      data?: Record<string, any>;
    },
  ) {
    const riders = await this.onlineRidersForBranch(branchId);
    for (const rider of riders) {
      try {
        await this.notificationService.create({
          branch_id: branchId,
          user_id: rider.user_id,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          data: payload.data ?? {},
        });
      } catch (err) {
        // per-rider notification failure must not break the broadcast
        console.warn(
          `Rider notification failed for ${rider.user_id}: ${err?.message ?? err}`,
        );
      }
    }
    return riders;
  }

  private toView(rider: Rider, user: User | null): RiderUserView {
    return {
      id: rider.id,
      user_id: rider.user_id,
      branch_id: rider.branch_id,
      business_id: rider.business_id,
      is_online: rider.is_online,
      vehicle: rider.vehicle,
      avatar_url: user?.avatar_url ?? null,
      full_name: user?.full_name ?? null,
      email: user?.email ?? null,
      phone: user?.phone ?? null,
      is_active: user?.is_active ?? true,
      created_at: rider.created_at,
    };
  }
}
