import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let response: any;
  let request: any;
  let host: any;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    request = { method: 'POST', url: '/api/v1/test' };
    host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    };
  });

  it('maps HttpException with string message', () => {
    filter.catch(new NotFoundException('Order not found'), host);
    const json = response.json.mock.calls[0][0];
    expect(response.status).toHaveBeenCalledWith(404);
    expect(json.success).toBe(false);
    expect(json.meta.code).toBe('NOT_FOUND');
    expect(json.meta.message).toEqual(['Order not found']);
  });

  it('maps validation array messages', () => {
    filter.catch(
      new BadRequestException(['name must be a string', 'price must be a number']),
      host,
    );
    const json = response.json.mock.calls[0][0];
    expect(response.status).toHaveBeenCalledWith(400);
    expect(json.meta.code).toBe('VALIDATION_ERROR');
    expect(json.meta.message).toHaveLength(2);
  });

  it('maps a duplicate-key (23505) driver error to 409', () => {
    const dbError = Object.assign(new Error('duplicate key'), {
      driverError: { code: '23505' },
    });
    filter.catch(dbError, host);
    const json = response.json.mock.calls[0][0];
    expect(response.status).toHaveBeenCalledWith(409);
    expect(json.meta.code).toBe('DUPLICATE_RESOURCE');
  });

  it('maps an unknown error to generic 500 with request id and logs', () => {
    const err = new Error('boom');
    const spy = jest.spyOn(filter['logger'], 'error');
    filter.catch(err, host);
    const json = response.json.mock.calls[0][0];
    expect(response.status).toHaveBeenCalledWith(500);
    expect(json.meta.code).toBe('INTERNAL_ERROR');
    expect(json.meta.message).toEqual(['Internal server error']);
    expect(typeof json.meta.requestId).toBe('string');
    expect(spy).toHaveBeenCalled();
  });
});