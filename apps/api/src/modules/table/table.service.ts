import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Table, TableStatus } from './entities/table.entity';
import { Tab } from '../tab/entities/tab.entity';

@Injectable()
export class TableService {
  constructor(
    @InjectRepository(Table)
    private tableRepository: Repository<Table>,
    @InjectRepository(Tab)
    private tabRepository: Repository<Tab>,
    @Inject(DataSource)
    private dataSource: DataSource,
  ) {}

  async create(createDto: any) {
    // Strip is_virtual if somehow passed — only TableSystemService.ensureSystemTables may set it
    delete createDto.is_virtual;

    if (createDto.table_number) {
      const existing = await this.tableRepository.findOne({
        where: {
          table_number: createDto.table_number,
          branch_id: createDto.branch_id,
        },
      });
      if (existing) {
        throw new BadRequestException(
          `Table number '${createDto.table_number}' already exists in this branch.`,
        );
      }
    }
    const table = this.tableRepository.create(createDto);
    return this.tableRepository.save(table);
  }

  async findAllByBranch(
    branchId: string,
    pagination?: { page: number; per_page: number },
  ) {
    const where = { branch_id: branchId };
    const skip = pagination
      ? (pagination.page - 1) * pagination.per_page
      : undefined;
    const take = pagination ? pagination.per_page : undefined;

    const [data, total] = await this.tableRepository.findAndCount({
      where,
      skip,
      take,
    });
    return { data, total };
  }

  async findOne(id: string, branchId: string) {
    const table = await this.tableRepository.findOne({
      where: { id, branch_id: branchId },
    });
    if (!table) {
      throw new NotFoundException('Table not found');
    }
    return table;
  }

  async updateStatus(id: string, branchId: string, status: TableStatus) {
    const table = await this.findOne(id, branchId);
    if (table.is_virtual) {
      throw new BadRequestException('System-managed table cannot be modified');
    }
    table.status = status;
    return this.tableRepository.save(table);
  }

  async update(id: string, branchId: string, updateDto: any) {
    const table = await this.findOne(id, branchId);
    if (table.is_virtual) {
      throw new BadRequestException('System-managed table cannot be modified');
    }
    Object.assign(table, updateDto);
    return this.tableRepository.save(table);
  }

  async remove(id: string, branchId: string) {
    const table = await this.findOne(id, branchId);
    if (table.is_virtual) {
      throw new BadRequestException('System-managed table cannot be modified');
    }
    return this.tableRepository.remove(table);
  }

  async release(
    id: string,
    branchId: string,
    currentUserId: string,
    currentUserRole: string,
  ) {
    if (currentUserRole !== 'owner' && currentUserRole !== 'manager') {
      throw new ForbiddenException(
        'Only owners and managers can release a table',
      );
    }

    const table = await this.findOne(id, branchId);
    if (table.is_virtual) {
      throw new BadRequestException('System-managed table cannot be modified');
    }

    const openTab = await this.tabRepository.findOne({
      where: { table_id: id, status: 'open' },
    });

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (openTab) {
        await queryRunner.manager.update(Tab, openTab.id, {
          status: 'voided',
          closed_at: new Date(),
          notes: `RELEASED by ${currentUserRole} (${currentUserId})`,
        });
      }

      await queryRunner.manager.update(Table, id, {
        status: TableStatus.AVAILABLE,
      });
      await queryRunner.commitTransaction();
      return { success: true, message: 'Table released' };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
