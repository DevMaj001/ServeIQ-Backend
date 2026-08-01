import { Test, TestingModule } from '@nestjs/testing';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Role } from '../role/entities/role.entity';
import { Permission } from '../role/entities/permission.entity';

describe('MenuController', () => {
  let controller: MenuController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MenuController],
      providers: [
        { provide: MenuService, useValue: {} },
        { provide: getRepositoryToken(Role), useValue: {} },
        { provide: getRepositoryToken(Permission), useValue: {} },
      ],
    }).compile();

    controller = module.get<MenuController>(MenuController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
