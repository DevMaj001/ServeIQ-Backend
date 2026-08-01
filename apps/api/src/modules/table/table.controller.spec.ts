import { Test, TestingModule } from '@nestjs/testing';
import { TableController } from './table.controller';
import { TableService } from './table.service';

describe('TableController', () => {
  let controller: TableController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TableController],
      providers: [{ provide: TableService, useValue: {} }],
    }).compile();

    controller = module.get<TableController>(TableController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
