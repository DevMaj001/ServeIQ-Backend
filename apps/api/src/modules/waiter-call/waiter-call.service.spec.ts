import { Test, TestingModule } from '@nestjs/testing';
import { WaiterCallService } from './waiter-call.service';
import { RealtimeService } from '../gateway/realtime.service';
import { WaiterCall, WaiterCallStatus } from './entities/waiter-call.entity';
import { Table } from '../table/entities/table.entity';
import { User } from '../user/entities/user.entity';
import { Branch } from '../branch/entities/branch.entity';
import { Tab } from '../tab/entities/tab.entity';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('WaiterCallService', () => {
  let service: WaiterCallService;
  let waiterCallRepo: any;
  let tableRepo: any;
  let userRepo: any;
  let branchRepo: any;
  let tabRepo: any;
  let realtime: any;
  let dataSource: any;

  const queryRunner = {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager: {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((_cls: any, data: any) => data),
      save: jest.fn((x) => Promise.resolve(x)),
    },
  };

  const makeCall = (over: Partial<WaiterCall> = {}): WaiterCall =>
    ({
      id: 'call-1',
      branch_id: 'branch-1',
      table_id: 'table-1',
      assigned_waiter_id: null,
      customer_session_id: null,
      status: WaiterCallStatus.PENDING,
      reason: null,
      accepted_at: null,
      arrived_at: null,
      resolved_at: null,
      cancelled_at: null,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      ...over,
    } as WaiterCall);

  beforeEach(async () => {
    waiterCallRepo = {
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve(x)),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };
    tableRepo = {
      findOne: jest.fn(),
    };
    userRepo = {
      find: jest.fn(),
    };
    branchRepo = {
      findOne: jest.fn().mockResolvedValue({ settings: { max_tables_per_waiter: 5 } }),
    };
    tabRepo = {
      count: jest.fn().mockResolvedValue(0),
    };
    realtime = {
      emitWaiterCall: jest.fn(),
    };
    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaiterCallService,
        { provide: getRepositoryToken(WaiterCall), useValue: waiterCallRepo },
        { provide: getRepositoryToken(Table), useValue: tableRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Branch), useValue: branchRepo },
        { provide: getRepositoryToken(Tab), useValue: tabRepo },
        { provide: RealtimeService, useValue: realtime },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(WaiterCallService);
  });

  it('creates an unassigned pending call and broadcasts it to all waiters', async () => {
    tableRepo.findOne.mockResolvedValue({ id: 'table-1', status: 'available' });
    queryRunner.manager.findOne.mockResolvedValue(null);

    const result = await service.createWaiterCall('table-1', 'branch-1');

    expect(result.status).toBe(WaiterCallStatus.PENDING);
    expect(result.assignedWaiter).toBeNull();
    expect(result.waiterCall.assigned_waiter_id).toBeNull();
    expect(realtime.emitWaiterCall).toHaveBeenCalledWith(
      'branch-1',
      'waiter.request.created',
      expect.objectContaining({ assignedWaiterId: null }),
    );
  });

  it('rejects a duplicate active request for the same table', async () => {
    tableRepo.findOne.mockResolvedValue({ id: 'table-1', status: 'available' });
    queryRunner.manager.findOne.mockResolvedValue(
      makeCall({ status: WaiterCallStatus.PENDING }),
    );

    await expect(service.createWaiterCall('table-1', 'branch-1')).rejects.toThrow(
      /already has an active waiter request/,
    );
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('transitions PENDING -> ACCEPTED, assigning it to the accepting waiter', async () => {
    waiterCallRepo.findOne.mockResolvedValue(
      makeCall({ status: WaiterCallStatus.PENDING, assigned_waiter_id: null }),
    );

    const call = await service.acceptWaiterCall('call-1', 'w1');

    expect(call.status).toBe(WaiterCallStatus.ACCEPTED);
    expect(call.assigned_waiter_id).toBe('w1');
    expect(realtime.emitWaiterCall).toHaveBeenCalledWith(
      'branch-1',
      'waiter.request.accepted',
      expect.any(Object),
    );
  });

  it('rejects accepting a call that is no longer pending', async () => {
    waiterCallRepo.findOne.mockResolvedValue(
      makeCall({ status: WaiterCallStatus.ACCEPTED, assigned_waiter_id: 'w1' }),
    );

    await expect(service.acceptWaiterCall('call-1', 'w2')).rejects.toThrow(
      /no longer awaiting a waiter/,
    );
  });

  it('marks a call as resolved', async () => {
    waiterCallRepo.findOne.mockResolvedValue(makeCall({ status: WaiterCallStatus.ARRIVED }));

    const call = await service.resolveWaiterCall('call-1');
    expect(call.status).toBe(WaiterCallStatus.RESOLVED);
  });
});
