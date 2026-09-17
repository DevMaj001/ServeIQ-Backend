import { PaymentReconciliationScheduler } from './payment-reconciliation.scheduler';
import { MoniepointApiClient } from './moniepoint-api.client';

describe('PaymentReconciliationScheduler', () => {
  const posTerminalRepo = { findOne: jest.fn() };
  const tabRepo = { findOne: jest.fn() };
  const branchRepo = { findOne: jest.fn(), find: jest.fn() };
  const billRepo = { findOne: jest.fn() };
  const notificationRepo = { findOne: jest.fn() };
  const notificationService = { create: jest.fn() };
  const client = {
    isConfigured: true,
    listSubscriptionEvents: jest.fn(),
  } as unknown as MoniepointApiClient;

  const scheduler = new PaymentReconciliationScheduler(
    posTerminalRepo as any,
    tabRepo as any,
    branchRepo as any,
    billRepo as any,
    notificationRepo as any,
    client as unknown as MoniepointApiClient,
    notificationService as any,
  );

  const page = (content: any[]) => ({
    content,
    totalElements: content.length,
    totalPages: 1,
    number: 0,
    size: 100,
    last: true,
  });

  const branch = {
    id: 'branch-1',
    settings: { payment_providers: [] },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (client.isConfigured as boolean) = true;
  });

  it('no-ops when the API client is not configured', async () => {
    (client as any).isConfigured = false;
    await scheduler.reconcile();
    expect(client.listSubscriptionEvents).not.toHaveBeenCalled();
    expect(notificationService.create).not.toHaveBeenCalled();
  });

  it('alerts a FAILED delivery that stopped retrying', async () => {
    (client.listSubscriptionEvents as jest.Mock).mockImplementation(
      ({ statuses }) =>
        page(
          statuses.includes('FAILED')
            ? [
                {
                  id: 'ev-1',
                  subscriptionId: 'sub-1',
                  status: 'FAILED',
                  retryTimes: 3,
                  retryAt: null,
                  endpointUrl: 'https://api.hospitalityos.app/wh',
                  payload: { reference: 'ref-1' },
                },
              ]
            : [],
        ),
    );
    billRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ tab_id: 'tab-1', branch_id: null });
    tabRepo.findOne.mockResolvedValue({ id: 'tab-1', branch_id: 'branch-1' });
    branchRepo.findOne.mockResolvedValue(branch);
    notificationRepo.findOne.mockResolvedValue(null);

    await scheduler.reconcile();

    expect(notificationService.create).toHaveBeenCalledTimes(1);
    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        branch_id: 'branch-1',
        type: 'payment_reconciliation',
        title: 'Failed Moniepoint Webhook Delivery',
        message: expect.stringContaining('ref: ref-1'),
        data: expect.objectContaining({
          event_id: 'ev-1',
          status: 'FAILED',
          retry_times: 3,
          endpoint_url: 'https://api.hospitalityos.app/wh',
          reason: 'failed',
        }),
      }),
    );
  });

  it('skips a FAILED delivery when Moniepoint still plans a retry', async () => {
    (client.listSubscriptionEvents as jest.Mock).mockResolvedValue(
      page([
        {
          id: 'ev-1',
          status: 'FAILED',
          retryAt: new Date(Date.now() + 60_000).toISOString(),
          payload: { reference: 'ref-1' },
        },
      ]),
    );

    await scheduler.reconcile();

    expect(notificationService.create).not.toHaveBeenCalled();
  });

  it('does not alert a PENDING delivery still within the retry window', async () => {
    (client.listSubscriptionEvents as jest.Mock).mockImplementation(
      ({ statuses }) =>
        page(
          statuses.includes('PENDING')
            ? [
                {
                  id: 'ev-p',
                  status: 'PENDING',
                  retryAt: null,
                  createdAt: new Date(Date.now() - 60_000).toISOString(),
                  payload: { reference: 'ref-1' },
                },
              ]
            : [],
        ),
    );

    await scheduler.reconcile();

    expect(notificationService.create).not.toHaveBeenCalled();
  });

  it('alerts a PENDING delivery that is stuck with no scheduled retry', async () => {
    (client.listSubscriptionEvents as jest.Mock).mockImplementation(
      ({ statuses }) =>
        page(
          statuses.includes('PENDING')
            ? [
                {
                  id: 'ev-p-stuck',
                  status: 'PENDING',
                  retryAt: null,
                  createdAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
                  payload: { reference: 'ref-1' },
                },
              ]
            : [],
        ),
    );
    billRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ tab_id: 'tab-1', branch_id: null });
    tabRepo.findOne.mockResolvedValue({ id: 'tab-1', branch_id: 'branch-1' });
    branchRepo.findOne.mockResolvedValue(branch);
    notificationRepo.findOne.mockResolvedValue(null);

    await scheduler.reconcile();

    expect(notificationService.create).toHaveBeenCalledTimes(1);
    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Stuck Moniepoint Webhook Delivery',
        data: expect.objectContaining({
          event_id: 'ev-p-stuck',
          reason: 'stuck-pending',
        }),
      }),
    );
  });

  it('does not alert a delivery whose payment reference is already settled', async () => {
    (client.listSubscriptionEvents as jest.Mock).mockResolvedValue(
      page([
        {
          id: 'ev-1',
          status: 'FAILED',
          retryAt: null,
          payload: { reference: 'ref-settled' },
        },
      ]),
    );
    billRepo.findOne.mockResolvedValue({
      payment_reference: 'ref-settled',
      paid_at: new Date(),
    });

    await scheduler.reconcile();

    expect(notificationService.create).not.toHaveBeenCalled();
  });

  it('does not duplicate an alert that already exists for the event', async () => {
    (client.listSubscriptionEvents as jest.Mock).mockResolvedValue(
      page([
        {
          id: 'ev-dup',
          status: 'FAILED',
          retryAt: null,
          payload: { reference: 'ref-1' },
        },
      ]),
    );
    billRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ tab_id: 'tab-1', branch_id: null });
    tabRepo.findOne.mockResolvedValue({ id: 'tab-1', branch_id: 'branch-1' });
    branchRepo.findOne.mockResolvedValue(branch);
    notificationRepo.findOne.mockResolvedValue({
      data: { event_id: 'ev-dup', reason: 'failed' },
    });

    await scheduler.reconcile();

    expect(notificationService.create).not.toHaveBeenCalled();
  });

  it('warns without alerting when no branch can be anchored, and does not throw', async () => {
    (client.listSubscriptionEvents as jest.Mock).mockResolvedValue(
      page([
        {
          id: 'ev-orphan',
          status: 'FAILED',
          retryAt: null,
          payload: { reference: 'ref-orphan' },
        },
      ]),
    );
    billRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    branchRepo.find.mockResolvedValue([]);

    await expect(scheduler.reconcile()).resolves.toBeUndefined();
    expect(notificationService.create).not.toHaveBeenCalled();
  });

  it('paginates through every page of failed deliveries', async () => {
    (client.listSubscriptionEvents as jest.Mock)
      .mockResolvedValueOnce({
        content: [
          {
            id: 'ev-p1',
            status: 'FAILED',
            retryAt: null,
            payload: { reference: 'ref-1' },
          },
        ],
        totalPages: 2,
        last: false,
      })
      .mockResolvedValueOnce({
        content: [
          {
            id: 'ev-p2',
            status: 'FAILED',
            retryAt: null,
            payload: { reference: 'ref-2' },
          },
        ],
        totalPages: 2,
        last: true,
      })
      .mockResolvedValueOnce(page([]));
    billRepo.findOne.mockResolvedValue(null);
    notificationRepo.findOne.mockResolvedValue(null);
    branchRepo.find.mockResolvedValue([]);

    await scheduler.reconcile();

    expect(client.listSubscriptionEvents).toHaveBeenCalledTimes(3);
    expect(notificationService.create).not.toHaveBeenCalled();
  });
});
