import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feedback } from './entities/feedback.entity';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(Feedback)
    private feedbackRepo: Repository<Feedback>,
  ) {}

  async create(user: any, dto: CreateFeedbackDto) {
    const feedback = new Feedback();
    feedback.business_id = user.businessId;
    feedback.branch_id = user.branchId || null;
    feedback.user_id = user.userId;
    feedback.category = dto.category;
    feedback.message = dto.message;
    feedback.screenshot = dto.screenshot || null;
    feedback.url = dto.url || null;
    feedback.user_agent = dto.userAgent || null;
    return this.feedbackRepo.save(feedback);
  }

  async findAll(
    user: any,
    query: {
      status?: string;
      category?: string;
      page?: string;
      limit?: string;
    },
  ) {
    const pageNum = Math.max(1, parseInt(query.page || '1', 10) || 1);
    const limitNum = Math.min(
      100,
      Math.max(1, parseInt(query.limit || '50', 10) || 50),
    );
    const skip = (pageNum - 1) * limitNum;

    const where: any = { business_id: user.businessId };
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;

    const [data, total] = await this.feedbackRepo.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip,
      take: limitNum,
    });

    return {
      data,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  async findAllForPlatform(query: {
    status?: string;
    page?: string;
    limit?: string;
  }) {
    const pageNum = Math.max(1, parseInt(query.page || '1', 10) || 1);
    const limitNum = Math.min(
      100,
      Math.max(1, parseInt(query.limit || '50', 10) || 50),
    );
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (query.status) where.status = query.status;

    const [data, total] = await this.feedbackRepo.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip,
      take: limitNum,
      relations: { user: true },
    });

    return {
      data,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  async updateStatus(id: string, status: string, adminNotes?: string) {
    const feedback = await this.feedbackRepo.findOne({ where: { id } });
    if (!feedback) {
      return null;
    }
    feedback.status = status;
    if (adminNotes !== undefined) feedback.admin_notes = adminNotes;
    return this.feedbackRepo.save(feedback);
  }
}
