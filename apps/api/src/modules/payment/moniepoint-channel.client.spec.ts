import {
  MoniepointChannelClient,
  MoniepointChannelConfigError,
} from './moniepoint-channel.client';

const BASE = 'https://channel.example.invalid';
const CLIENT_ID = 'api-client-test';
const CLIENT_SECRET = 'secret-test';
const AUTH_BODY = { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET };

describe('MoniepointChannelClient', () => {
  const fetchMock = jest.fn();
  let client: MoniepointChannelClient;

  const setEnv = () => {
    process.env.MONIEPOINT_CHANNEL_BASE_URL = BASE;
    process.env.MONIEPOINT_CLIENT_ID = CLIENT_ID;
    process.env.MONIEPOINT_CLIENT_API_KEY = CLIENT_SECRET;
  };

  const clearEnv = () => {
    delete process.env.MONIEPOINT_CHANNEL_BASE_URL;
    delete process.env.MONIEPOINT_CLIENT_ID;
    delete process.env.MONIEPOINT_CLIENT_API_KEY;
  };

  beforeEach(() => {
    setEnv();
    client = new MoniepointChannelClient();
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    fetchMock.mockReset();
    clearEnv();
  });

  it('throws MoniepointChannelConfigError at construction when any required var is unset', () => {
    clearEnv();
    expect(() => new MoniepointChannelClient()).toThrow(
      MoniepointChannelConfigError,
    );
  });

  it('lists the specific missing vars in the construction error', () => {
    clearEnv();
    delete process.env.MONIEPOINT_CLIENT_ID;
    process.env.MONIEPOINT_CHANNEL_BASE_URL = BASE;
    expect(() => new MoniepointChannelClient()).toThrow(/MONIEPOINT_CLIENT_ID/);
  });

  it('treats an empty value (e.g. VAR=) as missing, not a fallback', () => {
    clearEnv();
    process.env.MONIEPOINT_CHANNEL_BASE_URL = '';
    process.env.MONIEPOINT_CLIENT_ID = CLIENT_ID;
    process.env.MONIEPOINT_CLIENT_API_KEY = CLIENT_SECRET;
    expect(() => new MoniepointChannelClient()).toThrow(
      MoniepointChannelConfigError,
    );
  });

  it('constructs fine when all three vars are set', () => {
    expect(client).toBeInstanceOf(MoniepointChannelClient);
  });

  it('exchanges client credentials for a bearer token via POST /v1/auth', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        accessToken: 'token-abc',
        tokenType: { value: 'bearer' },
        expiresIn: 3600,
        scope: 'profile',
        jti: 'jti-1',
      }),
    );

    const token = await client.authenticate();

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${BASE}/v1/auth`);
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).headers).toEqual(
      expect.objectContaining({
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }),
    );
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
    });
    expect(token.accessToken).toBe('token-abc');
    expect(token.tokenType.value).toBe('bearer');
    expect(token.jti).toBe('jti-1');
  });

  it('throws MoniepointChannelError with the HTTP status on failure', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          message: 'Invalid credentials',
          status: 'UNAUTHORIZED',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(client.authenticate()).rejects.toMatchObject({
      name: 'MoniepointChannelError',
      status: 401,
    });
  });

  it('reuses the cached bearer token instead of re-authenticating', async () => {
    fetchMock.mockResolvedValueOnce(authResponse('token-abc'));

    await client.authenticate();
    await client.authenticate();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('calls authenticate again after invalidateToken()', async () => {
    fetchMock.mockResolvedValueOnce(authResponse('token-abc'));
    await client.authenticate();
    client.invalidateToken();

    fetchMock.mockResolvedValueOnce(authResponse('token-def'));
    await client.authenticate();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('pushPayment authenticates once, posts the request with Bearer auth, and accepts 202 with no body', async () => {
    fetchMock
      .mockResolvedValueOnce(authResponse('token-abc'))
      .mockResolvedValueOnce(
        new Response(null, { status: 202, statusText: 'Accepted' }),
      );

    await client.pushPayment({
      terminalSerial: 'P260xyz',
      amount: 11000,
      merchantReference: '12345',
      transactionType: 'PURCHASE',
      paymentMethod: 'CARD_PURCHASE',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [authUrl, authInit] = fetchMock.mock.calls[0];
    expect(String(authUrl)).toBe(`${BASE}/v1/auth`);
    expect(JSON.parse((authInit as RequestInit).body as string)).toEqual(
      AUTH_BODY,
    );

    const [txUrl, txInit] = fetchMock.mock.calls[1];
    expect(String(txUrl)).toBe(`${BASE}/v1/transactions`);
    expect((txInit as RequestInit).method).toBe('POST');
    expect((txInit as RequestInit).headers).toEqual(
      expect.objectContaining({
        Authorization: 'Bearer token-abc',
        'Content-Type': 'application/json',
      }),
    );
    expect(JSON.parse((txInit as RequestInit).body as string)).toMatchObject({
      terminalSerial: 'P260xyz',
      amount: 11000,
      merchantReference: '12345',
      transactionType: 'PURCHASE',
      paymentMethod: 'CARD_PURCHASE',
    });
  });

  it('throws MoniepointChannelError when Moniepoint rejects a duplicate merchantReference', async () => {
    fetchMock
      .mockResolvedValueOnce(authResponse('token-abc'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: 'Transaction exists',
            errors: ['Transaction exists'],
            status: 'BAD_REQUEST',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    await expect(
      client.pushPayment({
        terminalSerial: 'P260xyz',
        amount: 11000,
        merchantReference: '12345',
        transactionType: 'PURCHASE',
      }),
    ).rejects.toMatchObject({ name: 'MoniepointChannelError', status: 400 });
  });

  const authResponse = (accessToken: string) =>
    new Response(
      JSON.stringify({
        accessToken,
        tokenType: { value: 'bearer' },
        expiresIn: 3600,
        scope: 'profile',
        jti: 'jti-1',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );

  const jsonResponse = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
});
