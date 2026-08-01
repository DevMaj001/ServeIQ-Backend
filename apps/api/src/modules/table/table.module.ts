import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TableService } from './table.service';
import { TableSystemService } from './table-system.service';
import { TableController } from './table.controller';
import { Table } from './entities/table.entity';
import { Tab } from '../tab/entities/tab.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Table, Tab])],
  providers: [TableService, TableSystemService],
  controllers: [TableController],
  exports: [TableService, TableSystemService],
})
export class TableModule {}
