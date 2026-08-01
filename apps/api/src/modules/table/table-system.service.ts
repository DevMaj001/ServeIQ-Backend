import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Table } from './entities/table.entity';

export const VIRTUAL_COUNTER_INSERT_SQL = `
  INSERT INTO "tables" (id, branch_id, table_number, label, capacity, is_virtual, status)
  SELECT
    gen_random_uuid(),
    b.id,
    CONCAT('9999-', LEFT(b.id::text, 8)),
    'Takeaway Counter',
    0,
    true,
    'available'
  FROM "branches" b
  WHERE b.id = $1
    AND NOT EXISTS (
      SELECT 1 FROM "tables" t
      WHERE t.branch_id = b.id AND t.is_virtual = true
    )
`;

@Injectable()
export class TableSystemService {
  constructor(
    @InjectRepository(Table)
    private tableRepository: Repository<Table>,
  ) {}

  async ensureSystemTables(branchId: string): Promise<void> {
    await this.tableRepository.query(VIRTUAL_COUNTER_INSERT_SQL, [branchId]);
  }
}