import { Test, TestingModule } from '@nestjs/testing';
import { TabController } from './tab.controller';
import { TabService } from './tab.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

describe('TabController', () => {
  let controller: TabController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TabController],
      providers: [{ provide: TabService, useValue: {} }],
    })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TabController>(TabController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
