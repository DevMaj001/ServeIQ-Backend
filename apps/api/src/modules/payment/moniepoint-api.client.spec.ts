import {
  MoniepointApiClient,
  MoniepointApiError,
} from './moniepoint-api.client';

const BASE = 'https://api.pos.moniepoint.com';
const KEY = 'test-key';
const SUB = '11111111-1111-1111-1111-111111111111';

describe('MoniepointApiClient', () => {
  const fetchMock = jest.fn();
  let client: MoniepointApiClient;

  const setEnv = () => {
    process.env.MONIEPOINT_API_BASE_URL = BASE;
    process.env.MONIEPOINT_API_KEY = KEY;
    process.env.MONIEPOINT_WEBHOOK_SUBSCRIPTION_ID = SUB;
  };

  const clearEnv = () => {
    delete process.env.MONIEPOINT_API_BASE_URL;
    delete process.env.MONIEPOINT_API_KEY;
    delete process.env.MONIEPOINT_WEBHOOK_SUBSCRIPTION_ID;
  };

  const makeClient = () => new MoniepointApiClient();

  beforeEach(() => {
    setEnv();
    client = makeClient();
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    fetchMock.mockReset();
    clearEnv();
  });

  it('reports isConfigured false and refuses calls without credentials', async () => {
    clearEnv();
    const unconfigured = makeClient();
    expect(unconfigured.isConfigured).toBe(false);

    await expect(unconfigured.introspect()).rejects.toThrow(MoniepointApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is configured when base URL, key and subscription id are set', () => {
    expect(client.isConfigured).toBe(true);
  });

  it('lists subscription events with Bearer auth and repeated status params', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        content: [
          {
            id: 'ev-1',
            subscriptionId: SUB,
            status: 'FAILED',
            retryTimes: 3,
            retryAt: null,
            endpointUrl:
              'https://api.hospitalityos.app/public/payments/webhooks/monniepoint',
            payload: { reference: 'ref-1' },
          },
        ],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 100,
        last: true,
      }),
    );

    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-01-02T00:00:00.000Z');
    const page = await client.listSubscriptionEvents({
      statuses: ['FAILED', 'PENDING'],
      from,
      to,
      page: 0,
      size: 100,
    });

    const [url, init] = fetchMock.mock.calls[0];
    const urlStr = String(url);
    expect(urlStr).toContain('/v1/webhook-subscription-events');
    expect(urlStr).toContain(`subscriptionId=${SUB}`);
    expect(urlStr).toContain('status=FAILED');
    expect(urlStr).toContain('status=PENDING');
    expect(urlStr).toContain('from=2026-01-01');
    expect(urlStr).toContain('to=2026-01-02');
    expect((init as RequestInit).headers).toEqual(
      expect.objectContaining({
        Authorization: `Bearer ${KEY}`,
        Accept: 'application/json',
      }),
    );
    expect((init as RequestInit).method).toBe('GET');
    expect(page.content[0].status).toBe('FAILED');
    expect(page.content[0].endpointUrl).toContain('webhooks');
  });

  it('posts resend with the same filter contract', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        content: [
          {
            id: 'log-1',
            subscriptionId: SUB,
            subscriptionEventId: 'ev-1',
            status: 'PENDING',
            message: 'queued for redelivery',
          },
        ],
        totalElements: 1,
        totalPages: 1,
        last: true,
      }),
    );

    const from = new Date('2026-01-01T00:00:00.000Z');
    const result = await client.resendEvents({
      statuses: ['FAILED'],
      from,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/v1/webhook-subscription-events/resend');
    expect(String(url)).toContain('status=FAILED');
    expect((init as RequestInit).method).toBe('POST');
    expect(result.content[0].subscriptionEventId).toBe('ev-1');
  });

  it('introspects the API key scope', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        scopes: ['webhook:read', 'webhook:write'],
        businesses: [{ id: 1, businessName: 'Acme' }],
        authMethod: 'API_KEY',
        environment: 'SANDBOX',
      }),
    );

    const info = await client.introspect();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/v1/introspect');
    expect(info.scopes).toContain('webhook:read');
    expect(info.environment).toBe('SANDBOX');
  });

  it('throws MoniepointApiError with the HTTP status on failure', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(client.introspect()).rejects.toMatchObject({
      name: 'MoniepointApiError',
      status: 401,
    });
  });

  const jsonResponse = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
});
