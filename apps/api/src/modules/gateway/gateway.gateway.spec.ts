import { GatewayGateway } from './gateway.gateway';
import { JwtService } from '@nestjs/jwt';

/**
 * Regression tests for the branch claim handling in handleConnection.
 *
 * The auth JWT carries camelCase claims ({ branchId }), but the gateway
 * used to read payload.branch_id — so every socket had branchId undefined,
 * all tenants pooled in one `branch:undefined` room, and the real
 * `branch:<id>` rooms that RealtimeService emits to had no members.
 */
describe('GatewayGateway.handleConnection', () => {
  const makeClient = (token = 'valid-token') =>
    ({
      id: 'socket-1',
      handshake: { auth: { token }, headers: {} },
      join: jest.fn(),
      disconnect: jest.fn(),
    }) as any;

  const makeGateway = (payload: Record<string, unknown>) => {
    const jwtService = {
      verify: jest.fn().mockReturnValue(payload),
    } as unknown as JwtService;
    return new GatewayGateway(jwtService);
  };

  it('joins branch rooms using the camelCase branchId claim', async () => {
    const gateway = makeGateway({
      sub: 'user-1',
      branchId: 'branch-a',
      role: 'waiter',
    });
    const client = makeClient();

    await gateway.handleConnection(client);

    expect(client.branchId).toBe('branch-a');
    expect(client.join).toHaveBeenCalledWith('branch:branch-a');
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('adds managers to the managers room of their own branch', async () => {
    const gateway = makeGateway({
      sub: 'user-2',
      branchId: 'branch-b',
      role: 'manager',
    });
    const client = makeClient();

    await gateway.handleConnection(client);

    expect(client.join).toHaveBeenCalledWith('branch:branch-b');
    expect(client.join).toHaveBeenCalledWith('managers:branch-b');
  });

  it('never joins a room when the token has no branch claim', async () => {
    const gateway = makeGateway({ sub: 'user-3', role: 'superadmin' });
    const client = makeClient();

    await gateway.handleConnection(client);

    expect(client.join).not.toHaveBeenCalled();
  });

  it('disconnects clients presenting an invalid token', async () => {
    const jwtService = {
      verify: jest.fn().mockImplementation(() => {
        throw new Error('invalid signature');
      }),
    } as unknown as JwtService;
    const gateway = new GatewayGateway(jwtService);
    const client = makeClient('bad-token');

    await gateway.handleConnection(client);

    expect(client.disconnect).toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });

  it('disconnects clients presenting no token', async () => {
    const gateway = makeGateway({});
    const client = {
      id: 'socket-2',
      handshake: { auth: {}, headers: {} },
      join: jest.fn(),
      disconnect: jest.fn(),
    } as any;

    await gateway.handleConnection(client);

    expect(client.disconnect).toHaveBeenCalled();
  });
});
