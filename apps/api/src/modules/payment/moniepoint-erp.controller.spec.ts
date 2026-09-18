import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { MoniepointErpController } from './moniepoint-erp.controller';
import { MoniepointErpService } from './moniepoint-erp.service';
import { MoniepointChannelError } from './moniepoint-channel.client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

describe('MoniepointErpController', () => {
  let controller: MoniepointErpController;
  let service: {
    getCredential: jest.Mock;
    upsertCredential: jest.Mock;
    updateCredential: jest.Mock;
    pushPayment: jest.Mock;
    listPushes: jest.Mock;
  };

  const req = (overrides: any = {}) => ({
    user: { businessId: 'biz-1', branchId: 'branch-1', ...overrides },
  });

  const pushView = {
    id: 'push-1',
    billId: null,
    merchantReference: 'ref-1',
    terminalSerial: 'P260xyz',
    amountKobo: 11000,
    status: 'pending',
    error: null,
    pushedAt: new Date(),
    paidAt: null,
  };

  beforeEach(async () => {
    service = {
      getCredential: jest.fn().mockResolvedValue(null),
      upsertCredential: jest.fn().mockResolvedValue({ enrolled: true }),
      updateCredential: jest.fn().mockResolvedValue({ enrolled: true }),
      pushPayment: jest.fn().mockResolvedValue(pushView),
      listPushes: jest.fn().mockResolvedValue([]),
    };
    const module = await Test.createTestingModule({
      controllers: [MoniepointErpController],
      providers: [{ provide: MoniepointErpService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(MoniepointErpController);
  });

  it('routes getCredential through the current branch only', async () => {
    await controller.getCredential(req());
    expect(service.getCredential).toHaveBeenCalledWith('biz-1', 'branch-1');
  });

  it('routes enrollCredential with the authenticated tenant scope', async () => {
    const dto = {
      clientId: 'api-client-test',
      clientSecret: 'supersecret',
      environment: 'SANDBOX' as const,
    };
    await controller.enrollCredential(req(), dto);
    expect(service.upsertCredential).toHaveBeenCalledWith(
      'biz-1',
      'branch-1',
      dto,
    );
  });

  it('routes updateCredential with the authenticated tenant scope', async () => {
    const dto = { clientSecret: 'newsecret', environment: 'PROD' as const };
    await controller.updateCredential(req(), dto);
    expect(service.updateCredential).toHaveBeenCalledWith(
      'biz-1',
      'branch-1',
      dto,
    );
  });

  it('routes pushPayment with branch scope and returns the push view', async () => {
    const dto = {
      terminalSerial: 'P260xyz',
      amount: 11000,
      merchantReference: 'ref-1',
      paymentMethod: 'CARD_PURCHASE' as const,
      billId: 'bill-1',
    };
    const result = await controller.pushPayment(req(), dto);
    expect(service.pushPayment).toHaveBeenCalledWith(
      'biz-1',
      'branch-1',
      {
        terminalSerial: 'P260xyz',
        amount: 11000,
        merchantReference: 'ref-1',
        transactionType: 'PURCHASE',
        paymentMethod: 'CARD_PURCHASE',
      },
      { billId: 'bill-1' },
    );
    expect(result).toEqual({ pushed: true, push: pushView });
  });

  it('routes listPushes with branch scope, bill and status filters', async () => {
    const result = await controller.listPushes(req(), 'bill-1', 'pending');
    expect(service.listPushes).toHaveBeenCalledWith('biz-1', 'branch-1', {
      billId: 'bill-1',
      status: 'pending',
    });
    expect(result).toEqual({ pushes: [] });
  });

  it('maps a duplicate merchantReference (400 Transaction exists) to 409 Conflict', async () => {
    service.pushPayment.mockRejectedValueOnce(
      new MoniepointChannelError('Transaction exists', 400, {
        message: 'Transaction exists',
      }),
    );
    await expect(
      controller.pushPayment(req(), {
        terminalSerial: 'P260xyz',
        amount: 11000,
        merchantReference: 'ref-dup',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rethrows non-idempotency Moniepoint errors unchanged', async () => {
    service.pushPayment.mockRejectedValueOnce(
      new MoniepointChannelError('boom', 401, {}),
    );
    await expect(
      controller.pushPayment(req(), {
        terminalSerial: 'P260xyz',
        amount: 11000,
        merchantReference: 'ref-401',
      }),
    ).rejects.toBeInstanceOf(MoniepointChannelError);
  });
});
