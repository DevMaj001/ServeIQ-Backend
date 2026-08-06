import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditRepository: Repository<AuditLog>,
  ) {}

  async log(params: {
    branchId: string;
    userId?: string;
    action: string;
    entityId?: string;
    entityType?: string;
    payload?: Record<string, unknown>;
  }) {
    const entry = this.auditRepository.create({
      branch_id: params.branchId,
      user_id: params.userId,
      action: params.action,
      entity_id: params.entityId,
      entity_type: params.entityType,
      payload: params.payload,
    });
    return this.auditRepository.save(entry);
  }
}
