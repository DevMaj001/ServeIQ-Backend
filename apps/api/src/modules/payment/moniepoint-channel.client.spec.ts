import {
  MoniepointChannelClient,
  MoniepointChannelConfigError,
} from './moniepoint-channel.client';

const BASE = 'https://channel.example.invalid';
const CLIENT_ID = 'api-client-test';
const CLIENT_SECRET = 'secret-test';

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

  const jsonResponse = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
});
