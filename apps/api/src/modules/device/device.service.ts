import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from './entities/device.entity';

export interface RegisterDeviceInput {
  userId: string;
  businessId: string;
  branchId?: string;
  deviceId: string;
  deviceName?: string;
  platform?: string;
  appVersion?: string;
}

@Injectable()
export class DeviceService {
  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
  ) {}

  async register(input: RegisterDeviceInput): Promise<Device | null> {
    if (!input.deviceId) return null;

    try {
      let device = await this.deviceRepository.findOne({
        where: {
          device_id: input.deviceId,
          business_id: input.businessId,
        },
      });

      if (device) {
        if (device.is_active) {
          device.user_id = input.userId;
          device.branch_id = input.branchId || device.branch_id;
          device.device_name = input.deviceName || device.device_name;
          device.platform = input.platform || device.platform;
          device.app_version = input.appVersion || device.app_version;
          device.last_seen_at = new Date();
          return this.deviceRepository.save(device);
        }
        return null;
      }

      device = this.deviceRepository.create({
        user_id: input.userId,
        business_id: input.businessId,
        branch_id: input.branchId || null,
        device_id: input.deviceId,
        device_name: input.deviceName || null,
        platform: input.platform || null,
        app_version: input.appVersion || null,
        last_seen_at: new Date(),
        is_active: true,
      });
      return this.deviceRepository.save(device);
    } catch {
      return null;
    }
  }

  async listForBusiness(businessId: string) {
    return this.deviceRepository.find({
      where: { business_id: businessId },
      order: { last_seen_at: 'DESC' },
    });
  }

  async revoke(id: string, businessId: string) {
    const device = await this.deviceRepository.findOne({
      where: { id, business_id: businessId },
    });
    if (!device) throw new NotFoundException('Device not found');

    device.is_active = false;
    device.revoked_at = new Date();
    return this.deviceRepository.save(device);
  }

  async reactivate(id: string, businessId: string) {
    const device = await this.deviceRepository.findOne({
      where: { id, business_id: businessId },
    });
    if (!device) throw new NotFoundException('Device not found');

    device.is_active = true;
    device.revoked_at = null;
    return this.deviceRepository.save(device);
  }
}