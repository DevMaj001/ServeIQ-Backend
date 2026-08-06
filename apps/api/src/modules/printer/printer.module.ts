import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrinterService } from './printer.service';
import { PrinterController } from './printer.controller';
import { Printer } from './printer.entity';
import { PrintJob } from './print-job.entity';
import { Order } from '../order/entities/order.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Tab } from '../tab/entities/tab.entity';
import { Table } from '../table/entities/table.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Printer, PrintJob, Order, MenuItem, Tab, Table]),
  ],
  providers: [PrinterService],
  controllers: [PrinterController],
  exports: [PrinterService],
})
export class PrinterModule {}
